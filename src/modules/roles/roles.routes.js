const router = require('express').Router();
const controller = require('./roles.controller');
const requireAdminAuth = require('../../middlewares/adminAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Roles
 *     description: Roles & permissions (RBAC) for the admin panel
 * /admin/roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List of roles } }
 *   post:
 *     tags: [Roles]
 *     summary: Create a role
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string }, description: { type: string } } }
 *     responses: { 201: { description: Role created } }
 * /admin/roles/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: List every available permission
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: All permissions, grouped by module } }
 * /admin/roles/{id}:
 *   patch:
 *     tags: [Roles]
 *     summary: Update a role
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Roles]
 *     summary: Delete a role
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Deleted } }
 * /admin/roles/{id}/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: Get the permission ids assigned to a role
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Array of permission ids } }
 *   put:
 *     tags: [Roles]
 *     summary: Replace the permissions assigned to a role
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { permissionIds: { type: array, items: { type: integer } } } }
 *     responses: { 200: { description: Permissions updated } }
 */
router.use(requireAdminAuth);
router.get('/permissions', controller.listPermissions);
router.get('/', controller.list);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.get('/:id/permissions', controller.getRolePermissions);
router.put('/:id/permissions', controller.setRolePermissions);

module.exports = router;
