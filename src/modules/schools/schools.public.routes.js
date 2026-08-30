const router = require('express').Router();
const controller = require('./schools.controller');

/**
 * @swagger
 * /schools/verify/{code}:
 *   get:
 *     tags: [Schools]
 *     summary: Verify a school game code (public — used by the education flow)
 *     parameters: [{ in: path, name: code, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Valid code — returns the school }
 *       404: { description: Invalid code }
 */
router.get('/verify/:code', controller.verifyCode);

module.exports = router;
