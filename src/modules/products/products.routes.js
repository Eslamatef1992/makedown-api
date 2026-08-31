const router = require('express').Router();
const controller = require('./products.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Ecommerce → products & variants (admin)
 * /admin/products:
 *   get:
 *     tags: [Products]
 *     summary: List products
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated list } }
 *   post:
 *     tags: [Products]
 *     summary: Create a product
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a product with its variants and images
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Product detail } }
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 * /admin/products/{id}/variants:
 *   post:
 *     tags: [Products]
 *     summary: Add a variant to a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sku, price]
 *             properties:
 *               sku: { type: string }
 *               attributes: { type: object, example: { size: "M", color: "Pink" } }
 *               price: { type: number }
 *               compareAtPrice: { type: number }
 *               stockQuantity: { type: integer }
 *     responses: { 201: { description: Created } }
 * /admin/products/{id}/variants/generate:
 *   post:
 *     tags: [Products]
 *     summary: Generate variant combinations from selected variant types + values
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [selections, price]
 *             properties:
 *               selections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     typeId: { type: integer }
 *                     valueIds: { type: array, items: { type: integer } }
 *               price: { type: number }
 *               compareAtPrice: { type: number }
 *               stockQuantity: { type: integer }
 *     responses: { 200: { description: Created variants + skipped count } }
 * /admin/products/{id}/variants/{variantId}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a variant
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: variantId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Products]
 *     summary: Delete a variant
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: variantId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Deleted } }
 * /admin/products/{id}/images:
 *   post:
 *     tags: [Products]
 *     summary: Add a gallery image to a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageUrl]
 *             properties:
 *               imageUrl: { type: string }
 *               sortOrder: { type: integer }
 *     responses: { 201: { description: Created } }
 * /admin/products/{id}/images/{imageId}:
 *   delete:
 *     tags: [Products]
 *     summary: Remove a gallery image from a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: imageId, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOneWithVariants);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.post('/:id/variants', controller.addVariant);
router.post('/:id/variants/generate', controller.generateVariants);
router.patch('/:id/variants/:variantId', controller.updateVariant);
router.delete('/:id/variants/:variantId', controller.deleteVariant);
router.post('/:id/images', controller.addImage);
router.delete('/:id/images/:imageId', controller.deleteImage);

module.exports = router;
