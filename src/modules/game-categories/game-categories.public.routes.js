const router = require('express').Router();
const repo = require('./game-categories.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');

/**
 * @swagger
 * components:
 *   schemas:
 *     GameCategory:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         parent_id: { type: integer, nullable: true }
 *         name_en: { type: string }
 *         name_ar: { type: string }
 *         slug: { type: string }
 *         icon_url: { type: string, nullable: true }
 *         sort_order: { type: integer }
 *         is_active: { type: integer, enum: [0, 1], description: "Always 1 here — this endpoint pre-filters to active categories" }
 * /game-categories:
 *   get:
 *     tags: [Game Categories]
 *     summary: List active game categories (public)
 *     responses:
 *       200:
 *         description: List of categories
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/GameCategory' } } } }] } } }
 */
router.get('/', asyncHandler(async (req, res) => {
  const all = await repo.findAll();
  ok(res, all.filter((c) => c.is_active));
}));

module.exports = router;
