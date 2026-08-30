const router = require('express').Router();
const controller = require('./game-sessions.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Games History
 *     description: Read-only record of past/live game sessions
 * /admin/game-sessions:
 *   get:
 *     tags: [Games History]
 *     summary: List game sessions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [solo, team, random] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [waiting, active, finished, cancelled] }
 *     responses: { 200: { description: Paginated list } }
 * /admin/game-sessions/{id}:
 *   get:
 *     tags: [Games History]
 *     summary: Get a session with its participants and scores
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Session detail } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.get('/:id', controller.getOne);

module.exports = router;
