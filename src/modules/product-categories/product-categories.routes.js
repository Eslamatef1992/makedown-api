const router = require('express').Router();
const controller = require('./product-categories.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Product Categories
 *     description: Ecommerce → product categories (admin)
 * /admin/product-categories:
 *   get:
 *     tags: [Product Categories]
 *     summary: List product categories
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Product Categories]
 *     summary: Create a product category
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/product-categories/{id}:
 *   patch:
 *     tags: [Product Categories]
 *     summary: Update a product category
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Product Categories]
 *     summary: Delete a product category
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
