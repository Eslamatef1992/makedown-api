const router = require('express').Router();
const controller = require('./products.controller');

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Browse active products (public)
 *     description: >
 *       Products have no category concept (dropped in migrate_remove_product_categories.sql) —
 *       there is no categoryId filter. Use search and sort instead.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches against name (en/ar) and slug
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, oldest, price_asc, price_desc, name_asc, name_desc], default: newest }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
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
