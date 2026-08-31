const router = require('express').Router();
const controller = require('./orders.controller');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { checkout } = require('../../validators/checkout.validator');

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order (checkout) — works for a logged-in user or a guest
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingAddress, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId]
 *                   properties:
 *                     productId: { type: integer }
 *                     variantId: { type: integer, nullable: true }
 *                     quantity: { type: integer, default: 1 }
 *               shippingAddress:
 *                 type: object
 *                 required: [governorate, area, block, street, buildingNumber]
 *               paymentMethod: { type: string, enum: [knet, credit_card, cash] }
 *               discountCode: { type: string }
 *               guestName: { type: string, description: Required for guest checkout }
 *               guestEmail: { type: string, description: Required for guest checkout }
 *               guestPhone: { type: string }
 *     responses:
 *       201: { description: Order placed }
 *       400: { description: Validation error, or a product/variant is no longer available }
 */
router.post('/', optionalAuth, validate(checkout), controller.checkout);

/**
 * @swagger
 * /orders/track/{orderNumber}:
 *   get:
 *     tags: [Orders]
 *     summary: Look up an order by its order number (public — the order-confirmation page, including after a MyFatoorah redirect)
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Order with items }
 *       404: { description: Not found }
 */
router.get('/track/:orderNumber', controller.trackByOrderNumber);

module.exports = router;
