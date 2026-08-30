const router = require('express').Router();
const controller = require('./dashboard.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Dashboard
 * /admin/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Key platform stats for the dashboard landing page
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Stats object } }
 */
router.use(requireAdminAuth);
router.get('/stats', controller.stats);

module.exports = router;
