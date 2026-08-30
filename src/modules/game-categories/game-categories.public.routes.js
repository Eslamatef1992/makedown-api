const router = require('express').Router();
const repo = require('./game-categories.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');

/**
 * @swagger
 * /game-categories:
 *   get:
 *     tags: [Game Categories]
 *     summary: List active game categories (public)
 *     responses: { 200: { description: List of categories } }
 */
router.get('/', asyncHandler(async (req, res) => {
  const all = await repo.findAll();
  ok(res, all.filter((c) => c.is_active));
}));

module.exports = router;
