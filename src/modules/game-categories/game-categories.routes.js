const router = require('express').Router();
const controller = require('./game-categories.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Game Categories
 *     description: Categories (admin)
 * /admin/game-categories:
 *   get:
 *     tags: [Game Categories]
 *     summary: List game categories
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Game Categories]
 *     summary: Create a game category
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/game-categories/{id}:
 *   patch:
 *     tags: [Game Categories]
 *     summary: Update a game category
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Game Categories]
 *     summary: Delete a game category
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
