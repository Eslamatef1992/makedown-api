const router = require('express').Router();
const controller = require('./game-sessions.controller');
const requireAdminOrSchoolAuth = require('../../middlewares/adminOrSchoolAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Games History
 *     description: >
 *       Scheduled/hosted game sessions — admin sidebar "Games history", plus
 *       (for a school token) the admin panel "My Games" school-hosted-events
 *       flow. A school token can only create/see sessions it created
 *       (school_id = the token's school); an admin token sees everything.
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
 *     summary: "Create Game — a school/staff picks solo or team mode, bundles one or more games onto the board, and gets a single join code + QR that unlocks the whole board"
 *     description: >
 *       Every quizId bundled in must belong to the caller — for a school
 *       token, each one is checked against that school's own quizzes (see
 *       quizzes.controller.js) and the request is rejected if any quiz
 *       isn't theirs. A school-hosted session (school_id set) also makes
 *       joining free for players — see /play/sessions/join below, it
 *       doesn't charge their personal free-game/package credit.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quizIds]
 *             properties:
 *               mode: { type: string, enum: [solo, team, random], default: solo }
 *               quizIds: { type: array, items: { type: integer }, description: "Games bundled onto this session's shared board" }
 *               title: { type: string }
 *               schoolId: { type: integer, description: "Admin token only — ignored for a school token, which is always scoped to itself" }
 *               maxPlayers: { type: integer }
 *               audience: { type: string, enum: [girls, boys, mixed] }
 *               scheduledDate: { type: string, format: date }
 *               scheduledTime: { type: string, example: "14:30" }
 *               team1Name: { type: string, description: "mode = team only" }
 *               team1Capacity: { type: integer, description: "mode = team only" }
 *               team2Name: { type: string, description: "mode = team only" }
 *               team2Capacity: { type: integer, description: "mode = team only" }
 *     responses:
 *       201: { description: "Created game session — includes the generated joinCode" }
 *       400: { description: One or more selected games are not the caller's own (school token) }
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
