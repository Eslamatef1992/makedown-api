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
 *         schema: { type: string, enum: [newest, new_arrival, oldest, price_asc, price_desc, name_asc, name_desc, best_seller, bestseller, popular, offers], default: newest }
 *         description: >
 *           new_arrival is the same as newest (no separate "new" flag
 *           exists). best_seller/bestseller (both accepted, same ranking)
 *           and popular are computed from paid orders — best_seller ranks
 *           by total units sold, popular by number of distinct orders
 *           (there's no page-view/wishlist tracking to base "popular" on
 *           instead). offers orders active-discount products first (same
 *           "offer_price wins" rule as checkout/product detail), then
 *           newest — it's an ordering, not a filter, so non-offer products
 *           still appear afterward.
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
 * /products/{slug}/related:
 *   get:
 *     tags: [Products]
 *     summary: Related products (public)
 *     description: >
 *       Products have no category/tag data, so "related" is a price-proximity
 *       proxy — other active products within +/-25% of this product's
 *       base_price, closest first. Not a curated or category-based match.
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Up to 8 related products }
 *       404: { description: Not found }
 */
router.get('/', controller.publicList);
router.get('/:slug', controller.publicGetBySlug);
router.get('/:slug/related', controller.publicListRelated);

module.exports = router;
