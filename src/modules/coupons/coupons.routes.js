const router = require('express').Router();
const controller = require('./coupons.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Coupons
 *     description: Discount coupons for the ecommerce checkout (admin)
 * /admin/coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: List coupons
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Coupons]
 *     summary: Create a coupon
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, value]
 *             properties:
 *               code: { type: string }
 *               type: { type: string, enum: [percentage, fixed] }
 *               value: { type: number }
 *               minSubtotal: { type: number, nullable: true }
 *               maxUses: { type: integer, nullable: true }
 *               expiresAt: { type: string, format: date-time, nullable: true }
 *               isActive: { type: boolean }
 *     responses: { 201: { description: Created } }
 * /admin/coupons/{id}:
 *   patch:
 *     tags: [Coupons]
 *     summary: Update a coupon
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Coupons]
 *     summary: Delete a coupon
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);

module.exports = router;
