const router = require('express').Router();
const controller = require('./chat.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: My Chat
 *     description: The logged-in user's own conversations. Live delivery over Socket.io — connect and emit "auth" with your access token, then listen for "chat:message".
 * /me/chat/threads:
 *   get:
 *     tags: [My Chat]
 *     summary: List my conversations
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [My Chat]
 *     summary: Start (or reuse) a 1:1 conversation with another user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [userId], properties: { userId: { type: integer } } }
 *     responses: { 201: { description: Conversation ready } }
 * /me/chat/threads/{threadId}/messages:
 *   get:
 *     tags: [My Chat]
 *     summary: List messages in one of my conversations
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [My Chat]
 *     summary: Send a message
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [message], properties: { message: { type: string } } }
 *     responses: { 201: { description: Sent } }
 */
router.use(requireAuth);
router.get('/threads', controller.listMyThreads);
router.post('/threads', controller.startThread);
router.get('/threads/:threadId/messages', controller.getMyThreadMessages);
router.post('/threads/:threadId/messages', controller.sendMyMessage);

module.exports = router;
