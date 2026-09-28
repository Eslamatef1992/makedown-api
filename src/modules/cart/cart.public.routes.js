const router = require('express').Router();
const controller = require('./cart.controller');
const requireAuth = require('../../middlewares/auth.middleware');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { addItem, updateItem, merge } = require('../../validators/cart.validator');

/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: >
 *       Server-side cart — works for a logged-in user (keyed off the
 *       Bearer token) or a guest (keyed off a token this API hands back
 *       the first time GET /cart or POST /cart/items is called with no
 *       X-Guest-Token header). Send that token back as X-Guest-Token on
 *       every later cart call for the same guest. After login/register,
 *       call POST /cart/merge with that same token so items added before
 *       signing in aren't lost.
 * components:
 *   parameters:
 *     GuestTokenHeader:
 *       in: header
 *       name: X-Guest-Token
 *       required: false
 *       schema: { type: string }
 *       description: Omit for a logged-in request (Bearer token wins). Omit on a guest's very first call too — one is generated and returned.
 *   schemas:
 *     Cart:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         currency: { type: string, example: KWD }
 *         guestToken: { type: string, nullable: true, description: Null for a logged-in user's cart. Store this for a guest and send it back as X-Guest-Token. }
 *         itemCount: { type: integer }
 *         subtotal: { type: number }
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               productId: { type: integer }
 *               variantId: { type: integer, nullable: true }
 *               quantity: { type: integer }
 *               unitPrice: { type: number }
 *               lineTotal: { type: number }
 *               available: { type: boolean, description: False if the product/variant went inactive or out of stock since this was added. }
 *               product: { type: object }
 *               variant: { type: object, nullable: true }
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get (or silently create) the current cart
 *     parameters: [{ $ref: '#/components/parameters/GuestTokenHeader' }]
 *     responses:
 *       200: { description: The cart, content: { application/json: { schema: { $ref: '#/components/schemas/Cart' } } } }
 *   delete:
 *     tags: [Cart]
 *     summary: Empty the cart
 *     parameters: [{ $ref: '#/components/parameters/GuestTokenHeader' }]
 *     responses:
 *       200: { description: Cart cleared }
 */
router.get('/', optionalAuth, controller.getCart);
router.delete('/', optionalAuth, controller.clearCart);

/**
 * @swagger
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add an item to the cart (increments quantity if it's already in there)
 *     parameters: [{ $ref: '#/components/parameters/GuestTokenHeader' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: integer }
 *               variantId: { type: integer, nullable: true }
 *               quantity: { type: integer, default: 1 }
 *     responses:
 *       201: { description: Item added, content: { application/json: { schema: { $ref: '#/components/schemas/Cart' } } } }
 *       400: { description: Product/variant no longer available, or out of stock }
 */
router.post('/items', optionalAuth, validate(addItem), controller.addItem);

/**
 * @swagger
 * /cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Set a cart item's quantity
 *     parameters:
 *       - { $ref: '#/components/parameters/GuestTokenHeader' }
 *       - { in: path, name: itemId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [quantity], properties: { quantity: { type: integer } } }
 *     responses:
 *       200: { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/Cart' } } } }
 *       404: { description: Cart item not found }
 *   delete:
 *     tags: [Cart]
 *     summary: Remove an item from the cart
 *     parameters:
 *       - { $ref: '#/components/parameters/GuestTokenHeader' }
 *       - { in: path, name: itemId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Removed, content: { application/json: { schema: { $ref: '#/components/schemas/Cart' } } } }
 *       404: { description: Cart item not found }
 */
router.patch('/items/:itemId', optionalAuth, validate(updateItem), controller.updateItem);
router.delete('/items/:itemId', optionalAuth, controller.removeItem);

/**
 * @swagger
 * /cart/merge:
 *   post:
 *     tags: [Cart]
 *     summary: Merge a guest cart into the logged-in user's cart (call right after login/register)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [guestToken], properties: { guestToken: { type: string } } }
 *     responses:
 *       200: { description: Merged, content: { application/json: { schema: { $ref: '#/components/schemas/Cart' } } } }
 *       401: { description: Missing or invalid Authorization header }
 */
router.post('/merge', requireAuth, validate(merge), controller.mergeCart);

module.exports = router;
