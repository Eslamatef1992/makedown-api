const router = require('express').Router();
const controller = require('./schools.controller');

/**
 * @swagger
 * /schools:
 *   get:
 *     tags: [Schools]
 *     summary: List active schools (public — used by the education "Schools" page)
 *     responses: { 200: { description: List of schools } }
 */
/**
 * @swagger
 * /schools/{id}/games:
 *   get:
 *     tags: [Schools]
 *     summary: List a school's open games (public — the "<School> Games" page)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: List of open games for this school } }
 */
router.get('/', controller.publicList);

router.get('/:id/games', controller.publicGames);

module.exports = router;
