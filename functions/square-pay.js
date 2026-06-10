const { Client, Environment } = require('square');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox,
});

exports.handler = async (event, context) => {
  try {
    const { sourceId, amountMoney } = JSON.parse(event.body);
    const { result } = await client.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: context.awsRequestId,
      amountMoney: {
        amount: amountMoney.amount,
        currency: amountMoney.currency,
      },
    });
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
