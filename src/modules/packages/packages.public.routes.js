const router = require('express').Router();
const controller = require('./packages.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * /packages:
 *   get:
 *     tags: [Packages]
 *     summary: List active packages (public)
 *     responses: { 200: { description: List of packages } }
 * /packages/{id}/purchase:
 *   post:
 *     tags: [Packages]
 *     summary: Buy a package (requires login)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               paymentMethod: { type: string, enum: [knet, credit_card, cash] }
 *     responses:
 *       201:
 *         description: For cash, the package is granted immediately. For knet/credit_card, redirectUrl is a MyFatoorah hosted payment page.
 */
router.get('/', controller.publicList);
router.post('/:id/purchase', requireAuth, controller.purchase);

module.exports = router;
