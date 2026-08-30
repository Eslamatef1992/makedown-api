const router = require('express').Router();
const controller = require('./me.controller');
const requireAuth = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Me
 *     description: The logged-in customer's own profile, addresses, orders, packages and game history
 * /me:
 *   patch:
 *     tags: [Me]
 *     summary: Update my profile info
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Updated } }
 * /me/change-password:
 *   post:
 *     tags: [Me]
 *     summary: Change my password
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Changed } }
 * /me/addresses:
 *   get:
 *     tags: [Me]
 *     summary: List my saved addresses
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 *   post:
 *     tags: [Me]
 *     summary: Add a saved address
 *     security: [{ bearerAuth: [] }]
 *     responses: { 201: { description: Created } }
 * /me/addresses/{id}:
 *   patch:
 *     tags: [Me]
 *     summary: Update a saved address
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Me]
 *     summary: Delete a saved address
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Deleted } }
 * /me/orders:
 *   get:
 *     tags: [Me]
 *     summary: List my product orders
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated list } }
 * /me/orders/{id}:
 *   get:
 *     tags: [Me]
 *     summary: Get one of my orders with items
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Order detail } }
 * /me/packages:
 *   get:
 *     tags: [Me]
 *     summary: List packages I've purchased (current + history)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: List } }
 * /me/game-history:
 *   get:
 *     tags: [Me]
 *     summary: List games I've played
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Paginated list } }
 */
router.use(requireAuth);
router.patch('/', controller.updateProfile);
router.post('/avatar', controller.uploadAvatar);
router.post('/change-password', controller.changePassword);
router.get('/addresses', controller.listAddresses);
router.post('/addresses', controller.createAddress);
router.patch('/addresses/:id', controller.updateAddress);
router.delete('/addresses/:id', controller.deleteAddress);
router.get('/orders', controller.listMyOrders);
router.get('/orders/:id', controller.getMyOrder);
router.get('/packages', controller.listMyPackages);
router.get('/game-history', controller.listGameHistory);

module.exports = router;
