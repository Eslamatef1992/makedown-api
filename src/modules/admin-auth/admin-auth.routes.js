const router = require('express').Router();
const Joi = require('joi');

const controller = require('./admin-auth.controller');
const requireAdminOrSchoolAuth = require('../../middlewares/adminOrSchoolAuth.middleware');
const validate = require('../../middlewares/validate.middleware');

const loginSchema = Joi.object({
  // An admin's email, or a school's contact email — see admin-auth.service.js.
  // Schools no longer have a separate login "code"; the contact email set
  // on the school (required + unique, see schools.controller.js) doubles
  // as its login identifier.
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});

/**
 * @swagger
 * tags:
 *   - name: Admin Auth
 *     description: One shared login for the admin panel — resolves to either a super-admin or a school account depending on the identifier
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Admin or school login
 *     description: >
 *       Single login endpoint for both super admins and schools. `identifier` is
 *       tried as an admin email first, then as a school's contact email — schools
 *       no longer have a separate "code" to log in with. The response's `role`
 *       field tells the frontend which shell to route into, and the returned
 *       `accessToken` is a JWT carrying `type: admin_access` or `type: school_access`
 *       (see utils/tokens.js) that every other `/admin/*` endpoint below accepts
 *       via `requireAdminAuth` (admin-only) or `requireAdminOrSchoolAuth` (either).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: "Admin email, or a school's contact email", example: "school@example.com" }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Authenticated session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role: { type: string, enum: [admin, school] }
 *                 accessToken: { type: string }
 *                 admin:
 *                   type: object
 *                   description: Present when role is "admin"
 *                   properties:
 *                     id: { type: integer }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     roleId: { type: integer }
 *                     permissions: { type: array, items: { type: string } }
 *                 school:
 *                   type: object
 *                   description: Present when role is "school"
 *                   properties:
 *                     id: { type: integer }
 *                     nameEn: { type: string }
 *                     nameAr: { type: string }
 *                     logoUrl: { type: string, nullable: true }
 *       401: { description: Invalid email or password }
 *       403: { description: This admin account has been disabled }
 */
router.post('/login', validate(loginSchema), controller.login);

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Current admin or school profile
 *     description: Returns the admin profile + permissions, or the school profile, depending on which type of token is presented.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Admin or school profile, shaped like the login response's admin/school object (with a role field) }
 *       401: { description: Missing, invalid, or expired token }
 */
router.get('/me', requireAdminOrSchoolAuth, controller.me);

module.exports = router;
