const router = require('express').Router();
const controller = require('./schools.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Schools
 *     description: Education → Schools (admin)
 * /admin/schools:
 *   get:
 *     tags: [Schools]
 *     summary: List schools
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of schools } }
 *   post:
 *     tags: [Schools]
 *     summary: Create a school
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /admin/schools/{id}:
 *   patch:
 *     tags: [Schools]
 *     summary: Update a school
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
