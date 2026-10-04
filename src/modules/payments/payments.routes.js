const router = require('express').Router();
const controller = require('./payments.controller');

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: >
 *       MyFatoorah hosted-payment-page callback. Never trusts its own query
 *       string — always re-confirms the real payment status with
 *       MyFatoorah's GetPaymentStatus API first, updates the order/package,
 *       sends the confirmation email, and only then redirects. By the time
 *       the redirect (or deep link) fires, the order's status in the
 *       database is already final.
 * /payments/myfatoorah/callback:
 *   get:
 *     tags: [Payments]
 *     summary: MyFatoorah redirects the browser/webview here after a payment attempt (success or failure)
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema: { type: string, enum: [mobile] }
 *         description: >
 *           Present only when POST /orders was called with platform:
 *           "mobile" — this callback URL is generated server-side in
 *           orders.controller.js#checkout, never passed in by the client
 *           directly. When set (and the server has MOBILE_APP_SCHEME
 *           configured), redirects to the app's deep link instead of a
 *           website page. Package purchases don't support this yet —
 *           always redirect to the website's /profile/payment-result.
 *     responses:
 *       302:
 *         description: >
 *           Redirects to one of: `{FRONTEND_URL}/order-placed`,
 *           `{FRONTEND_URL}/order-failed`,
 *           `{FRONTEND_URL}/profile/payment-result` (packages), or — mobile
 *           product orders only — `{MOBILE_APP_SCHEME}://order-placed` /
 *           `{MOBILE_APP_SCHEME}://order-failed`. Query params on the
 *           redirect: `status` (success|failed), `orderId`, and on success
 *           `orderNumber` too — e.g.
 *           `makedownapp://order-placed?status=success&orderId=234&orderNumber=MDLXJ400A2C3`.
 *           A webview can detect this navigation itself, or the app can
 *           just poll `GET /orders/track/{orderNumber}` instead of relying
 *           on catching the redirect at all.
 */
router.get('/myfatoorah/callback', controller.myFatoorahCallback);

module.exports = router;
