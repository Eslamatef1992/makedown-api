const router = require('express').Router();
const controller = require('./packages.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Packages
 *     description: Subscription/credit packages (admin)
 * /admin/packages:
 *   get:
 *     tags: [Packages]
 *     summary: List packages
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Packages]
 *     summary: Create a package
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/packages/{id}:
 *   patch:
 *     tags: [Packages]
 *     summary: Update a package
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Packages]
 *     summary: Delete a package
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
