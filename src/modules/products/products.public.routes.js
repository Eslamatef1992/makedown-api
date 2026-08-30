const router = require('express').Router();
const controller = require('./products.controller');

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Browse active products (public)
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses: { 200: { description: Paginated list } }
 * /products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Get a product by slug (public)
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Product with active variants and images }
 *       404: { description: Not found }
 */
router.get('/', controller.publicList);
router.get('/:slug', controller.publicGetBySlug);

module.exports = router;
