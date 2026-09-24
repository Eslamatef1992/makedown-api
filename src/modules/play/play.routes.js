const router = require('express').Router();
const controller = require('./play.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     GameSessionDetail:
 *       type: object
 *       description: >
 *         Full game state — returned by create, join, get, and re-broadcast
 *         over Socket.io as `game:state` on every change. Top-level session
 *         fields are raw `game_sessions` columns (snake_case); the fields
 *         listed explicitly below are computed extras added on top.
 *       properties:
 *         id: { type: integer, example: 91 }
 *         title: { type: string, nullable: true, example: "Grade 6 Science Trivia" }
 *         host_user_id: { type: integer, example: 501 }
 *         school_id: { type: integer, nullable: true, example: 4 }
 *         mode: { type: string, enum: [solo, team, random], example: team }
 *         is_public: { type: integer, enum: [0, 1], example: 0 }
 *         max_players: { type: integer, nullable: true }
 *         join_code: { type: string, example: "7F3KQ2" }
 *         qr_code_url: { type: string, nullable: true, example: "data:image/png;base64,iVBORw0..." }
 *         status: { type: string, enum: [waiting, active, finished, cancelled], example: waiting }
 *         current_turn_index: { type: integer, example: 0 }
 *         current_question_id: { type: integer, nullable: true }
 *         turn_started_at: { type: string, format: date-time, nullable: true }
 *         turn_ends_at: { type: string, format: date-time, nullable: true }
 *         started_at: { type: string, format: date-time, nullable: true }
 *         ended_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         turnOrder: { type: array, items: { type: integer }, description: "Ordered list of game_participants.id — whose turn is next" }
 *         currentTurnParticipantId: { type: integer, nullable: true }
 *         currentQuestion: { type: object, nullable: true, description: "The active tile's question, answer key stripped, or null between tiles" }
 *         awaitingScan: { type: boolean, description: "True while a QR/audio question is waiting to be revealed (see /play/sessions/{id}/scan and /reveal)" }
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties: { id: { type: integer }, user_id: { type: integer, nullable: true }, guest_name: { type: string, nullable: true }, team_id: { type: integer, nullable: true }, score: { type: integer }, full_name: { type: string }, avatar_url: { type: string, nullable: true } }
 *         teams:
 *           type: array
 *           description: Empty array outside team mode.
 *           items: { type: object, properties: { id: { type: integer }, name: { type: string }, color: { type: string, nullable: true }, score: { type: integer } } }
 *         board:
 *           type: array
 *           description: One entry per chosen category/quiz, each with its 6 point tiles.
 *           items: { type: object }
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode, quizIds]
 *             properties:
 *               mode: { type: string, enum: [solo, team, random], example: team }
 *               quizIds: { type: array, items: { type: integer }, example: [12, 15, 19], description: "Category/quiz ids for the board — at least one" }
 *               title: { type: string, example: "Grade 6 Science Trivia" }
 *               isPublic: { type: boolean, default: false }
 *               maxPlayers: { type: integer, nullable: true }
 *               team1Name: { type: string, example: "Team A", description: "Required when mode = team" }
 *               team2Name: { type: string, example: "Team B", description: "Required when mode = team" }
 *               team1Players: { type: array, items: { type: string }, example: ["Ali", "Reem"] }
 *               team2Players: { type: array, items: { type: string }, example: ["Fatima"] }
 *     responses:
 *       201:
 *         description: Game created — the host is participant #1
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/GameSessionDetail' } } }] } } }
 *       400:
 *         description: No category selected, or team names missing for team mode
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Select at least one category" } } }
 *       402:
 *         description: Free game already used and no active package
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "You've used your free game. Subscribe to a package to keep playing." } } }
 * /play/sessions/join:
 *   post:
 *     tags: [Play]
 *     summary: Join a game by its join code
 *     description: >
 *       Consumes the joining player's free game / package credit — unless
 *       the session is school-hosted (schools/game-sessions.controller.js
 *       "Create Game"), in which case joining is free for the player; the
 *       school hosts the event, so a student shouldn't burn their own
 *       credit to attend it. A school's own join code (from its "My Games")
 *       works the same way here as any other game's — there's no separate
 *       endpoint for it, and it's never returned by GET /schools/{id}/games
 *       (a teacher hands it out separately, outside the app).
 *
 *       A school-scheduled game (scheduledDate/scheduledTime set) only opens
 *       10 minutes before its start time — joining earlier than that with an
 *       otherwise-valid code returns 400, not 404.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [joinCode]
 *             properties:
 *               joinCode: { type: string, example: "7F3KQ2", description: "The session's join code, case-insensitive" }
 *     responses:
 *       200:
 *         description: Joined — returns full game state
 *         content:
 *           application/json:
 *             schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/GameSessionDetail' } } }] }
 *             example:
 *               success: true
 *               message: "Joined"
 *               data: { id: 91, title: "Grade 6 Science Trivia", host_user_id: 501, school_id: 4, mode: team, is_public: 0, join_code: "7F3KQ2", status: waiting, current_turn_index: 0, current_question_id: null, awaitingScan: false, turnOrder: [], currentTurnParticipantId: null, currentQuestion: null, participants: [], teams: [], board: [] }
 *       400:
 *         description: Game not joinable right now (e.g. a scheduled school game that hasn't opened yet)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             example: { success: false, message: "This game opens 10 minutes before its start time (10:30)." }
 *       402:
 *         description: No game credits remaining (not applicable to school-hosted sessions)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             example: { success: false, message: "You've used your free game. Subscribe to a package to keep playing." }
 *       404:
 *         description: Invalid join code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             example: { success: false, message: "No game found with that code" }
 *       409:
 *         description: "The session is full, or has already started/finished (mapped from SESSION_FULL / SESSION_NOT_JOINABLE)"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               full: { value: { success: false, message: "session full" } }
 *               notJoinable: { value: { success: false, message: "session not joinable" } }
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
 *     description: >
 *       Poll this (or listen for the `game:state` Socket.io event, same
 *       shape) to keep the lobby/live screen in sync between actions.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200:
 *         description: Full game state
 *         content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: object, properties: { data: { $ref: '#/components/schemas/GameSessionDetail' } } }] } } }
 *       404:
 *         description: Session doesn't exist
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "Game not found" } } }
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
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [questionId], properties: { questionId: { type: integer, example: 305 } } } } }
 *     responses:
 *       200:
 *         description: >
 *           Tile opened. For a text/image question, awaitingScan is false and
 *           timeLimitSeconds is the answer window that already started. For a
 *           qr/audio question, awaitingScan is true and nothing starts until
 *           /scan or /reveal is called — for qr, scanUrl/scanQrDataUrl are
 *           also included so the mobile app can show a real QR code, not
 *           just a URL.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiSuccess' }
 *             examples:
 *               textOrImage: { value: { success: true, message: OK, data: { question: { id: 305, question_type: text, question_text_en: "Capital of Japan?", options_json_en: "[\"Tokyo\",\"Osaka\",\"Kyoto\",\"Nagoya\"]", points: 200 }, awaitingScan: false, timeLimitSeconds: 20 } } }
 *               qr: { value: { success: true, message: OK, data: { question: { id: 306, question_type: qr, points: 400 }, awaitingScan: true, scanToken: "9f1c...", scanUrl: "https://www.makedown.online/play/scan/91/9f1c...", scanQrDataUrl: "data:image/png;base64,iVBORw0..." } } }
 *       403: { description: Not this player's turn, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "not your turn" } } } }
 *       409: { description: A tile is already open, or this one was already played, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "tile already in progress" } } } }
 * /play/sessions/{id}/scan:
 *   post:
 *     tags: [Play]
 *     summary: Confirm the QR code was scanned for a QR-gated question, starting its timer
 *     description: Called from the scan-confirmation page a second device opens — see GET-by-link flow at /play/scan/{sessionId}/{token} on the website. Can be called any number of times with the same token.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [token], properties: { token: { type: string } } } } }
 *     responses:
 *       200: { description: Question revealed, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: OK, data: { question: { id: 306, question_type: qr }, timeLimitSeconds: 20 } } } } }
 *       400: { description: Wrong/expired token, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "invalid scan token" } } } }
 * /play/sessions/{id}/reveal:
 *   post:
 *     tags: [Play]
 *     summary: Reveal an audio question after its clip finished playing, starting its timer (no scan token needed)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Question revealed, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: OK, data: { question: { id: 307, question_type: audio }, timeLimitSeconds: 20 } } } } }
 *       409: { description: No audio question is currently awaiting reveal, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "no active question" } } } }
 * /play/sessions/{id}/answer:
 *   post:
 *     tags: [Play]
 *     summary: Submit an answer for the active tile (text/image/audio — not qr, see qr-answer)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId]
 *             properties:
 *               questionId: { type: integer, example: 305 }
 *               selectedOptionIndex: { type: integer, nullable: true, example: 0, description: "0-based option index, or omit/null to skip/timeout" }
 *               timeTakenMs: { type: integer, nullable: true, example: 4200 }
 *     responses:
 *       200:
 *         description: >
 *           Whether the pick was right. In team mode, when a first team just
 *           answers, the fuller game:answer_result / game:next_team_turn
 *           Socket.io events (not this HTTP response) carry whether the tile
 *           is fully settled yet.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: OK, data: { isCorrect: true, correctOptionIndex: 0 } } } }
 *       409:
 *         description: Awaiting a qr/audio reveal first, time already expired, or no active question
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *             examples:
 *               awaitingScan: { value: { success: false, message: "awaiting scan" } }
 *               timeExpired: { value: { success: false, message: "time expired" } }
 * /play/sessions/{id}/qr-answer:
 *   post:
 *     tags: [Play]
 *     summary: "Host-only: grade a QR-gated question — pick which team (participantId) answered correctly, or none, settling the tile"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId]
 *             properties:
 *               questionId: { type: integer, example: 306 }
 *               winnerParticipantId: { type: integer, nullable: true, example: 812, description: "Omit or null for \"No one answered\"" }
 *     responses:
 *       200: { description: Tile settled, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' }, example: { success: true, message: OK, data: { winnerParticipantId: 812, points: 400 } } } } }
 *       403: { description: Caller isn't this game's host, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' }, example: { success: false, message: "not host" } } } }
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
router.post('/sessions/:id/reveal', controller.revealQuestion);
router.post('/sessions/:id/answer', controller.submitAnswer);
router.post('/sessions/:id/qr-answer', controller.qrAnswer);

router.post('/sessions/:id/lifelines/fifty-fifty', controller.fiftyFifty);
router.post('/sessions/:id/lifelines/skip', controller.skip);
router.post('/sessions/:id/lifelines/phone-a-friend', controller.phoneAFriend);
router.post('/lifeline-requests/:requestId/respond', controller.respondPhoneAFriend);

router.get('/sessions/:id/invite-search', controller.searchInvitees);
router.post('/sessions/:id/invite', controller.invite);
router.post('/invites/:inviteId/respond', controller.respondInvite);

router.post('/sessions/:id/score-adjustment', controller.adjustScore);

module.exports = router;
