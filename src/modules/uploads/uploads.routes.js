const router = require('express').Router();
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');
const controller = require('./uploads.controller');

/**
 * @swagger
 * tags:
 *   - name: Uploads
 * /admin/uploads/image:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload an image file (product thumbnail, quiz cover, school logo, category icon, ...)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Uploaded file URL }
 *       400: { description: Invalid file type or file too large }
 */
router.post('/image', requireAdminAuth, controller.uploadImage);

module.exports = router;
