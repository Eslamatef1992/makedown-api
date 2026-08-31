const router = require('express').Router();
const controller = require('./site-settings.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Site Settings
 *     description: Singleton site settings (admin)
 * /admin/site-settings/home-video:
 *   get:
 *     tags: [Site Settings]
 *     summary: Get the Home page video YouTube URL
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Current URL } }
 *   put:
 *     tags: [Site Settings]
 *     summary: Set the Home page video YouTube URL
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Saved } }
 */
router.use(requireAdminAuth);
router.get('/home-video', controller.adminGetHomeVideo);
router.put('/home-video', controller.adminSetHomeVideo);
router.get('/delivery-fee', controller.adminGetDeliveryFee);
router.put('/delivery-fee', controller.adminSetDeliveryFee);
router.get('/contact-info', controller.adminGetContactInfo);
router.put('/contact-info', controller.adminSetContactInfo);

module.exports = router;
