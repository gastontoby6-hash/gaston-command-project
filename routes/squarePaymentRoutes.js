/**
 * Island Breeze Smoke House - Square Payment Routes
 * 
 * Wires up the Square payment controller to Express endpoints
 */

const express = require('express');
const router = express.Router();
const squarePaymentController = require('../controllers/squarePaymentController');

/**
 * POST /api/square-create-order
 * 
 * Main endpoint for processing orders with Square payments
 * 
 * Request Body:
 * {
 *   "sourceId": "sq0_real_card_token",
 *   "idempotencyKey": "unique-uuid",
 *   "orderType": "DELIVERY",
 *   "deliveryAddress": "633 Mills St, Watertown, NY",
 *   "total": 3100,
 *   "items": [...]
 * }
 */
router.post('/square-create-order', squarePaymentController.createOrder);

/**
 * GET /api/square-create-order/status/:orderId
 * 
 * Check the status of an order
 */
router.get('/square-create-order/status/:orderId', squarePaymentController.getOrderStatus);

/**
 * POST /api/square-webhooks
 * 
 * Webhook endpoint for Square events (optional)
 */
router.post('/square-webhooks', squarePaymentController.handleWebhook);

module.exports = router;