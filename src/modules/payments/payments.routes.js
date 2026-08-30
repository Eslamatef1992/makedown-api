const router = require('express').Router();
const controller = require('./payments.controller');

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: MyFatoorah hosted-payment-page callback
 * /payments/myfatoorah/callback:
 *   get:
 *     tags: [Payments]
 *     summary: MyFatoorah redirects the browser here after a payment attempt (success or failure)
 *     responses: { 302: { description: Redirects to the website's payment result page } }
 */
router.get('/myfatoorah/callback', controller.myFatoorahCallback);

module.exports = router;
