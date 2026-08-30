const router = require('express').Router();
const controller = require('./variant-types.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Variant Types
 *     description: Reusable product variant types (e.g. Color, Width, Height) and their values (admin)
 * /admin/variant-types:
 *   get:
 *     tags: [Variant Types]
 *     summary: List variant types
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Variant Types]
 *     summary: Create a variant type
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/variant-types/with-values:
 *   get:
 *     tags: [Variant Types]
 *     summary: List all variant types with their values (for the product form)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 * /admin/variant-types/{id}:
 *   patch:
 *     tags: [Variant Types]
 *     summary: Update a variant type
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Variant Types]
 *     summary: Delete a variant type
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 * /admin/variant-types/{id}/values:
 *   post:
 *     tags: [Variant Types]
 *     summary: Add a value to a variant type
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [valueEn, valueAr]
 *             properties:
 *               valueEn: { type: string }
 *               valueAr: { type: string }
 *               sortOrder: { type: integer }
 *     responses: { 201: { description: Created } }
 * /admin/variant-types/{id}/values/{valueId}:
 *   patch:
 *     tags: [Variant Types]
 *     summary: Update a value
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Variant Types]
 *     summary: Delete a value
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/with-values', controller.listWithValues);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.post('/:id/values', controller.addValue);
router.patch('/:id/values/:valueId', controller.updateValue);
router.delete('/:id/values/:valueId', controller.deleteValue);

module.exports = router;
