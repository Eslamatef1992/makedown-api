const router = require('express').Router();
const controller = require('./users.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: Manage customer accounts (User management → Users / special users)
 * /admin/users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: is_special
 *         schema: { type: integer, enum: [0, 1] }
 *         description: Filter to special users only (1)
 *     responses: { 200: { description: Paginated list of users } }
 * /admin/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: User } }
 *   patch:
 *     tags: [Users]
 *     summary: Toggle a user's active / special-user status
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { isActive: { type: boolean }, isSpecial: { type: boolean } } }
 *     responses: { 200: { description: Updated } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);

module.exports = router;
