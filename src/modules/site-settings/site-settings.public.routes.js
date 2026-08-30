const router = require('express').Router();
const controller = require('./site-settings.controller');

/**
 * @swagger
 * /site-settings/home-video:
 *   get:
 *     tags: [Site Settings]
 *     summary: Get the Home page video YouTube URL (public)
 *     responses: { 200: { description: Current URL } }
 */
router.get('/home-video', controller.publicGetHomeVideo);

module.exports = router;
