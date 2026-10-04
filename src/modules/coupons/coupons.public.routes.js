const router = require('express').Router();
const controller = require('./coupons.controller');

/**
 * @swagger
 * /coupons/validate/{code}:
 *   get:
 *     tags: [Coupons]
 *     summary: Preview a coupon's discount for a given subtotal (public — cart/checkout "Apply")
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: subtotal
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Coupon is valid — discount preview
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: object, properties: { code: { type: string, example: WELCOME10 }, type: { type: string, enum: [percentage, fixed], example: percentage }, value: { type: number, example: 10 }, discountTotal: { type: number, example: 1.3, description: "Capped at the subtotal, already rounded to 3dp" } } } } }] }
 *       400:
 *         description: >
 *           Invalid, expired, exhausted, or minimum not met — same rules
 *           and same error shape POST /orders uses when discountCode fails
 *           at actual checkout time (coupons.service.js#validateCoupon is
 *           shared by both). `details.code` is a stable machine-readable
 *           reason so the app doesn't have to match English message text.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               expired: { value: { success: false, message: "This coupon has expired.", details: { code: "COUPON_EXPIRED" } } }
 *               minSubtotal: { value: { success: false, message: "This coupon requires a minimum order of 20.000.", details: { code: "COUPON_MIN_SUBTOTAL_NOT_MET", minSubtotal: 20 } } }
 */
router.get('/validate/:code', controller.validate);

module.exports = router;
