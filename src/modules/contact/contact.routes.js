const router = require('express').Router();
const controller = require('./contact.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Get In Touch
 *     description: Contact form submissions
 * /admin/contact-messages:
 *   get:
 *     tags: [Get In Touch]
 *     summary: List contact messages
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated list } }
 * /admin/contact-messages/{id}:
 *   get:
 *     tags: [Get In Touch]
 *     summary: Get a message
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Message } }
 *   patch:
 *     tags: [Get In Touch]
 *     summary: Update a message's status (new/read/replied)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);

module.exports = router;
