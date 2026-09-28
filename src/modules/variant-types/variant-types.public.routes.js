const router = require('express').Router();
const controller = require('./variant-types.controller');

/**
 * @swagger
 * tags:
 *   - name: Variant Types
 *     description: Reusable product variant types (Color, Size, ...) — public read-only catalog
 * /variant-types:
 *   get:
 *     tags: [Variant Types]
 *     summary: List active variant types with their values (public)
 *     description: >
 *       Fetch and cache once — lets the app resolve a product variant's
 *       `attributes` (see GET /products/{slug}) against real labels/hex
 *       colors, or build a color/size filter UI, without hitting the
 *       admin-only /admin/variant-types.
 *     responses:
 *       200:
 *         description: Active variant types, each with its active-type's values
 */
router.get('/', controller.publicListWithValues);

module.exports = router;
