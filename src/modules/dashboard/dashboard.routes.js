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
/**
 * @swagger
 * /admin/dashboard/top-products:
 *   get:
 *     tags: [Dashboard]
 *     summary: Best-selling products by units sold
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6 }
 *     responses: { 200: { description: Ranked product list } }
 * /admin/dashboard/top-categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Game categories ranked by active quiz count
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6 }
 *     responses: { 200: { description: Ranked category list } }
 * /admin/dashboard/sales-series:
 *   get:
 *     tags: [Dashboard]
 *     summary: Daily revenue for the trailing N days
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses: { 200: { description: Daily revenue series } }
 * /admin/dashboard/new-users-series:
 *   get:
 *     tags: [Dashboard]
 *     summary: Daily new-user signups for the trailing N days
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses: { 200: { description: Daily signup series } }
 */
router.use(requireAdminAuth);
router.get('/stats', controller.stats);
router.get('/top-products', controller.topProducts);
router.get('/top-categories', controller.topCategories);
router.get('/sales-series', controller.salesSeries);
router.get('/new-users-series', controller.newUsersSeries);

module.exports = router;
