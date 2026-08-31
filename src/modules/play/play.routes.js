const router = require('express').Router();
const controller = require('./play.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Play
 *     description: Live multiplayer game engine — create/join a game, the Jeopardy-style points board, turns, lifelines, invites
 * /play/quizzes:
 *   get:
 *     tags: [Play]
 *     summary: List quizzes (categories) that have at least one question, for board selection
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *       - in: query
 *         name: mode
 *         schema: { type: string, enum: [solo, team] }
 *         description: Only return quizzes the admin marked as supporting this mode (or 'both')
 *     responses: { 200: { description: List of quizzes } }
 * /play/sessions:
 *   post:
 *     tags: [Play]
 *     summary: Create a game (host) — pick mode + categories, get a join code
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created game session } }
 * /play/sessions/join:
 *   post:
 *     tags: [Play]
 *     summary: Join a game by its join code
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Joined } }
 * /play/sessions/public:
 *   get:
 *     tags: [Play]
 *     summary: Browse public "random" games open for matchmaking
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of public waiting games } }
 * /play/sessions/{id}:
 *   get:
 *     tags: [Play]
 *     summary: Get full game state (lobby / live board / scores)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Game detail } }
 * /play/sessions/{id}/start:
 *   post:
 *     tags: [Play]
 *     summary: Host starts the game
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Started } }
 * /play/sessions/{id}/leave:
 *   post:
 *     tags: [Play]
 *     summary: Leave a game
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Left } }
 * /play/sessions/{id}/match-random:
 *   post:
 *     tags: [Play]
 *     summary: "Start Play With Random User — join an existing open public game or open this one for matching"
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Matched } }
 * /play/sessions/{id}/pick-tile:
 *   post:
 *     tags: [Play]
 *     summary: Current-turn player picks a category + point tile from the board
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Tile opened } }
 * /play/sessions/{id}/scan:
 *   post:
 *     tags: [Play]
 *     summary: Confirm the QR code was scanned for a QR-gated question, starting its timer
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Question revealed } }
 * /play/sessions/{id}/answer:
 *   post:
 *     tags: [Play]
 *     summary: Submit an answer for the active tile
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Result } }
 * /play/sessions/{id}/lifelines/fifty-fifty:
 *   post:
 *     tags: [Play]
 *     summary: Use the 50/50 lifeline (once per game) — hides two wrong options
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Options to hide } }
 * /play/sessions/{id}/lifelines/skip:
 *   post:
 *     tags: [Play]
 *     summary: Use the Skip lifeline (once per game) — passes the tile with no score
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Skipped } }
 * /play/sessions/{id}/lifelines/phone-a-friend:
 *   post:
 *     tags: [Play]
 *     summary: Use the Phone-a-Friend lifeline (once per game) — pings another participant live
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Friend notified } }
 * /play/lifeline-requests/{requestId}/respond:
 *   post:
 *     tags: [Play]
 *     summary: The pinged friend suggests an answer back to the requester
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Sent } }
 * /play/sessions/{id}/invite-search:
 *   get:
 *     tags: [Play]
 *     summary: Search users by name to invite into the game
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Matching users } }
 * /play/sessions/{id}/invite:
 *   post:
 *     tags: [Play]
 *     summary: Send an invite to a user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Invited } }
 * /play/invites/{inviteId}/respond:
 *   post:
 *     tags: [Play]
 *     summary: Accept or decline an invite
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Responded } }
 * /play/sessions/{id}/score-adjustment:
 *   post:
 *     tags: [Play]
 *     summary: Host manually adjusts a participant's score (+/- controls on the board)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Adjusted } }
 */

router.use(requireAuth);

router.get('/quizzes', controller.listPlayableQuizzes);

router.post('/sessions', controller.createSession);
router.post('/sessions/join', controller.joinByCode);
router.get('/sessions/public', controller.listPublicSessions);
router.get('/sessions/:id', controller.getSession);
router.post('/sessions/:id/start', controller.startSession);
router.post('/sessions/:id/leave', controller.leaveSession);
router.post('/sessions/:id/match-random', controller.matchRandom);

router.post('/sessions/:id/pick-tile', controller.pickTile);
router.post('/sessions/:id/scan', controller.scanQuestion);
router.post('/sessions/:id/answer', controller.submitAnswer);

router.post('/sessions/:id/lifelines/fifty-fifty', controller.fiftyFifty);
router.post('/sessions/:id/lifelines/skip', controller.skip);
router.post('/sessions/:id/lifelines/phone-a-friend', controller.phoneAFriend);
router.post('/lifeline-requests/:requestId/respond', controller.respondPhoneAFriend);

router.get('/sessions/:id/invite-search', controller.searchInvitees);
router.post('/sessions/:id/invite', controller.invite);
router.post('/invites/:inviteId/respond', controller.respondInvite);

router.post('/sessions/:id/score-adjustment', controller.adjustScore);

module.exports = router;
