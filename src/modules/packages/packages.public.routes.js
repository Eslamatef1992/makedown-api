const router = require('express').Router();
const controller = require('./packages.controller');

/**
 * @swagger
 * /packages:
 *   get:
 *     tags: [Packages]
 *     summary: List active packages (public)
 *     responses: { 200: { description: List of packages } }
 */
router.get('/', controller.publicList);

module.exports = router;
