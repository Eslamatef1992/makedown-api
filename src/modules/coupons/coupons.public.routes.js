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
 *       200: { description: Coupon is valid — discount preview }
 *       400: { description: Invalid, expired, exhausted, or minimum not met }
 */
router.get('/validate/:code', controller.validate);

module.exports = router;
