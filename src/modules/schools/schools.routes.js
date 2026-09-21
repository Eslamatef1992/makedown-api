const router = require('express').Router();
const controller = require('./schools.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Schools
 *     description: >
 *       Education → Schools (super admin only — a school itself can't call
 *       these, see admin-auth.middleware.js). A school has no separate
 *       login "code" any more — contactEmail is required and unique, and
 *       doubles as the school's login identifier at POST /admin/auth/login
 *       once a password is set.
 * /admin/schools:
 *   get:
 *     tags: [Schools]
 *     summary: List schools
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of schools } }
 *   post:
 *     tags: [Schools]
 *     summary: Create a school
 *     description: >
 *       contactEmail and password are both required on create (password has
 *       no "current value" to fall back on for a brand-new school, and
 *       contactEmail is how it logs in) — omitting either is rejected with
 *       400. contactEmail must also be unique across schools. isActive
 *       defaults to true when omitted, since an inactive school can't log
 *       in or appear on the public site.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameEn, nameAr, contactEmail, password]
 *             properties:
 *               nameEn: { type: string }
 *               nameAr: { type: string }
 *               contactEmail: { type: string, format: email, description: "Required, unique — also the school's login identifier" }
 *               password: { type: string, format: password, description: "Required on create" }
 *               contactPhone: { type: string }
 *               logoUrl: { type: string }
 *               address: { type: string }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: "Missing/duplicate contactEmail, missing password, or password under 6 characters" }
 * /admin/schools/{id}:
 *   patch:
 *     tags: [Schools]
 *     summary: Update a school
 *     description: password is optional here — leave it out to keep the school's current password. contactEmail, if sent, is still checked for uniqueness against other schools.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Schools]
 *     summary: Delete a school
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 */
router.use(requireAdminAuth);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);

module.exports = router;
