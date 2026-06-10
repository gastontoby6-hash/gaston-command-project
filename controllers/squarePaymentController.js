/**
 * Island Breeze Smoke House - Production Square Payment Handler
 * 
 * Endpoint: POST /api/square-create-order
 * 
 * This controller handles secure payment processing with Square's production API.
 * It validates incoming payment tokens, creates orders, and processes charges
 * using the production Square SDK client.
 */

const { Client, Environment } = require('square');

/**
 * Initialize Square Client with Production Credentials
 * 
 * The Square Client uses your SQUARE_ACCESS_TOKEN from .env
 * to authenticate all API requests against Square's production environment.
 */
const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production,
    userAgentDetail: 'IslandBreezeSmokehouse/1.0'
});

/**
 * POST /api/square-create-order
 * 
 * Processes a payment order with the following workflow:
 * 1. Validate incoming payload structure and required fields
 * 2. Create an order in Square Catalog
 * 3. Tokenize and charge the payment method
 * 4. Return order confirmation with ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Payment payload from frontend
 * @param {string} req.body.sourceId - Card token from Square Web Payments SDK
 * @param {string} req.body.idempotencyKey - UUID to prevent duplicate charges
 * @param {string} req.body.orderType - "PICKUP" or "DELIVERY"
 * @param {string} req.body.deliveryAddress - Delivery address (if orderType === "DELIVERY")
 * @param {number} req.body.total - Total in cents (e.g., 3100 = $31.00)
 * @param {Array} req.body.items - Array of ordered items
 * @param {Object} res - Express response object
 */
exports.createOrder = async (req, res) => {
    try {
        // ============================================
        // 1. VALIDATE INCOMING PAYLOAD
        // ============================================
        const { sourceId, idempotencyKey, orderType, deliveryAddress, total, items } = req.body;

        // Validate required fields
        if (!sourceId || !idempotencyKey || !orderType || !total || !items) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sourceId, idempotencyKey, orderType, total, items'
            });
        }

        // Validate orderType
        if (!['PICKUP', 'DELIVERY'].includes(orderType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid orderType. Must be PICKUP or DELIVERY'
            });
        }

        // Validate delivery address if delivery order
        if (orderType === 'DELIVERY' && !deliveryAddress) {
            return res.status(400).json({
                success: false,
                error: 'Delivery address required for DELIVERY orders'
            });
        }

        // Validate total is a positive integer (in cents)
        if (typeof total !== 'number' || total <= 0 || !Number.isInteger(total)) {
            return res.status(400).json({
                success: false,
                error: 'Total must be a positive integer (in cents)'
            });
        }

        // Validate items array is not empty
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array must contain at least one item'
            });
        }

        console.log('✅ Payload validation passed');
        console.log(`📦 Order Type: ${orderType}`);
        console.log(`💰 Total: $${(total / 100).toFixed(2)}`);
        console.log(`🛒 Items: ${items.length}`);

        // ============================================
        // 2. CREATE ORDER IN SQUARE CATALOG
        // ============================================
        const ordersApi = squareClient.ordersApi;

        // Build order items array for Square API
        const squareOrderItems = items.map(item => ({
            quantity: String(item.quantity),
            catalogObjectId: item.catalog_object_id || undefined, // Optional: if using catalog
            name: item.name,
            basePriceMoney: {
                amount: BigInt(item.unit_price_cents),
                currency: 'USD'
            },
            grossSalesMoney: {
                amount: BigInt(item.unit_price_cents * item.quantity),
                currency: 'USD'
            }
        }));

        // Create order request body
        const createOrderRequest = {
            idempotencyKey: idempotencyKey,
            order: {
                locationId: process.env.SQUARE_LOCATION_ID,
                lineItems: squareOrderItems,
                totalMoney: {
                    amount: BigInt(total),
                    currency: 'USD'
                },
                referenceId: `IBSH-${Date.now()}`, // Unique reference for tracking
                customFields: [
                    {
                        key: 'order_type',
                        value: orderType
                    },
                    ...(orderType === 'DELIVERY' ? [
                        {
                            key: 'delivery_address',
                            value: deliveryAddress
                        }
                    ] : [])
                ]
            }
        };

        console.log('📝 Creating Square order...');
        const { result: orderResult } = await ordersApi.createOrder(createOrderRequest);
        const orderId = orderResult.order.id;

        console.log(`✅ Order created: ${orderId}`);

        // ============================================
        // 3. PROCESS PAYMENT WITH TOKENIZED CARD
        // ============================================
        const paymentsApi = squareClient.paymentsApi;

        // Create payment request
        const createPaymentRequest = {
            sourceId: sourceId, // Card token from frontend Square SDK
            idempotencyKey: idempotencyKey, // Prevent duplicate charges
            amountMoney: {
                amount: BigInt(total),
                currency: 'USD'
            },
            orderId: orderId, // Link payment to order
            autocomplete: true, // Automatically capture payment
            receiptNumber: `IBSH-${Date.now()}`, // Receipt tracking
            customerId: undefined, // Optional: associate with Square customer
            note: `Island Breeze Smoke House - ${orderType} Order`,
            metadata: {
                orderType: orderType,
                deliveryAddress: deliveryAddress || 'Pickup',
                itemCount: String(items.length)
            }
        };

        console.log('💳 Processing payment...');
        const { result: paymentResult } = await paymentsApi.createPayment(createPaymentRequest);
        const paymentId = paymentResult.payment.id;
        const paymentStatus = paymentResult.payment.status;

        console.log(`✅ Payment processed: ${paymentId}`);
        console.log(`📊 Payment Status: ${paymentStatus}`);

        // ============================================
        // 4. VERIFY PAYMENT SUCCESS
        // ============================================
        if (paymentStatus !== 'COMPLETED') {
            console.error(`❌ Payment not completed. Status: ${paymentStatus}`);
            return res.status(402).json({
                success: false,
                error: `Payment failed with status: ${paymentStatus}`,
                paymentId: paymentId
            });
        }

        // ============================================
        // 5. SEND CONFIRMATION RESPONSE
        // ============================================
        const responsePayload = {
            success: true,
            orderId: orderId,
            paymentId: paymentId,
            amount: total / 100, // Convert back to dollars for display
            orderType: orderType,
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: (item.unit_price_cents / 100).toFixed(2)
            })),
            message: `Order #${orderId.slice(-8)} confirmed! Payment of $${(total / 100).toFixed(2)} processed successfully.`,
            deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress : null,
            timestamp: new Date().toISOString()
        };

        console.log('✅ Order confirmation prepared');
        console.log(`🎉 Response: ${JSON.stringify(responsePayload, null, 2)}`);

        return res.status(200).json(responsePayload);

    } catch (error) {
        // ============================================
        // ERROR HANDLING
        // ============================================
        console.error('❌ Order processing error:', error);

        // Handle specific Square API errors
        if (error.errors && Array.isArray(error.errors)) {
            const squareErrors = error.errors.map(err => ({
                code: err.code,
                detail: err.detail,
                field: err.field
            }));

            console.error('Square API Errors:', squareErrors);

            return res.status(400).json({
                success: false,
                error: 'Payment processing failed',
                details: squareErrors
            });
        }

        // Handle authentication errors
        if (error.statusCode === 401 || error.statusCode === 403) {
            console.error('❌ Authentication/Authorization error - check SQUARE_ACCESS_TOKEN');
            return res.status(403).json({
                success: false,
                error: 'Payment service authentication failed. Contact support.'
            });
        }

        // Handle network/timeout errors
        if (error.statusCode >= 500) {
            console.error('❌ Square API server error');
            return res.status(503).json({
                success: false,
                error: 'Payment service temporarily unavailable. Please try again.'
            });
        }

        // Generic error response
        return res.status(500).json({
            success: false,
            error: 'An unexpected error occurred while processing your order',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/square-create-order/status/:orderId
 * 
 * Check the status of a previously created order
 * 
 * @param {Object} req - Express request
 * @param {string} req.params.orderId - Square Order ID
 * @param {Object} res - Express response
 */
exports.getOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'Order ID is required'
            });
        }

        const ordersApi = squareClient.ordersApi;
        const { result } = await ordersApi.retrieveOrder(orderId);

        return res.status(200).json({
            success: true,
            order: {
                id: result.order.id,
                status: result.order.state,
                total: result.order.totalMoney.amount / 100,
                createdAt: result.order.createdAt,
                updatedAt: result.order.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Error retrieving order status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retrieve order status'
        });
    }
};

/**
 * Webhook Handler for Square Payment Webhooks (Optional)
 * 
 * Listen for payment.created, payment.updated events from Square
 * to update your database in real-time
 * 
 * POST /api/square-webhooks
 */
exports.handleWebhook = async (req, res) => {
    try {
        const event = req.body;

        console.log(`📨 Webhook received: ${event.type}`);

        switch (event.type) {
            case 'payment.created':
            case 'payment.updated':
                console.log(`💳 Payment event:`, event.data.object.payment);
                // Update your database with payment status
                break;

            case 'order.created':
            case 'order.updated':
                console.log(`📦 Order event:`, event.data.object.order);
                // Update your order records
                break;

            default:
                console.log(`ℹ️ Unhandled webhook type: ${event.type}`);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
};

/**
 * Utility: Validate Square Webhook Signature (Recommended)
 * 
 * Use this to verify webhooks are genuinely from Square
 */
exports.verifyWebhookSignature = (req, webhookSignatureKey) => {
    const {
        WebhookSignatureHelper
    } = require('square');

    const requestBody = JSON.stringify(req.body);
    const signatureHeader = req.get('X-Square-Hmac-SHA256');
    const signatureKey = webhookSignatureKey;

    return WebhookSignatureHelper.isValidSignature(
        requestBody,
        signatureHeader,
        signatureKey,
        'https://yourdomain.com/api/square-webhooks' // Your webhook URL
    );
};

module.exports = exports;