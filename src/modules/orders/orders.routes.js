const router = require('express').Router();
const controller = require('./orders.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Orders + Orders as a guest (filter with ?guest=1)
 * /admin/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: guest
 *         schema: { type: string, enum: ["0", "1"] }
 *         description: "1 = guest orders only, 0 = account orders only, omit = all"
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses: { 200: { description: Paginated list } }
 * /admin/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get an order with its line items
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Order detail } }
 *   patch:
 *     tags: [Orders]
 *     summary: Update order/payment status
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [pending, paid, processing, shipped, delivered, cancelled, refunded] }
 *               paymentStatus: { type: string, enum: [unpaid, paid, failed, refunded] }
 *     responses: { 200: { description: Updated } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateStatus);

module.exports = router;
