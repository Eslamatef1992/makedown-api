const router = require('express').Router();
const Joi = require('joi');

const controller = require('./admin-auth.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');
const validate = require('../../middlewares/validate.middleware');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * @swagger
 * tags:
 *   - name: Admin Auth
 *     description: Admin panel login (separate token scope from customer accounts)
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Authenticated admin session }
 *       401: { description: Invalid credentials }
 */
router.post('/login', validate(loginSchema), controller.login);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Current admin profile + permissions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Admin profile }
 */
router.get('/me', requireAdminAuth, controller.me);

module.exports = router;
