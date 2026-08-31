const router = require('express').Router();
const controller = require('./game-sessions.controller');
const requireAdminOrSchoolAuth = require('../../middlewares/adminOrSchoolAuth.middleware');

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
 *   post:
 *     tags: [Games History]
 *     summary: "Create Game — a school/staff picks solo or team mode, specializes categories, and gets a join code + QR"
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created game session } }
 * /admin/game-sessions/{id}:
 *   get:
 *     tags: [Games History]
 *     summary: Get a session with its participants and scores
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Session detail } }
 */
router.use(requireAdminOrSchoolAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);

module.exports = router;
