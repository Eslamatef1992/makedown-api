const router = require('express').Router();
const controller = require('./chat.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Read-only view of user-to-user chat threads. Live sending happens over Socket.io on the website (see docs/PROJECT_PLAN.md — full chat UX is a follow-up module).
 * /admin/chat/threads:
 *   get:
 *     tags: [Chat]
 *     summary: List chat threads
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated list } }
 * /admin/chat/threads/{id}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: Get a thread's messages
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Messages } }
 */
router.use(requireAdminAuth);
router.get('/threads', controller.listThreads);
router.get('/threads/:id/messages', controller.getMessages);

module.exports = router;
