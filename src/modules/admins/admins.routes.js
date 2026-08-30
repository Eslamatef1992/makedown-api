const router = require('express').Router();
const controller = require('./admins.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Admins
 *     description: Manage admin panel user accounts
 * /admin/admins:
 *   get:
 *     tags: [Admins]
 *     summary: List admins
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list of admins }
 *   post:
 *     tags: [Admins]
 *     summary: Create an admin
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               roleId: { type: integer }
 *     responses:
 *       201: { description: Admin created }
 * /admin/admins/{id}:
 *   get:
 *     tags: [Admins]
 *     summary: Get an admin by id
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Admin } }
 *   patch:
 *     tags: [Admins]
 *     summary: Update an admin
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Admins]
 *     summary: Delete an admin
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);

module.exports = router;
