const router = require('express').Router();

// ---- Customer-facing auth ----
router.use('/auth', require('../modules/auth/auth.routes'));

// ---- Admin panel: auth + RBAC ----
router.use('/admin/auth', require('../modules/admin-auth/admin-auth.routes'));
router.use('/admin/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/admin/admins', require('../modules/admins/admins.routes'));
router.use('/admin/roles', require('../modules/roles/roles.routes'));
router.use('/admin/users', require('../modules/users/users.routes'));

// ---- Admin panel: education ----
router.use('/admin/schools', require('../modules/schools/schools.routes'));
router.use('/admin/quizzes', require('../modules/quizzes/quizzes.routes'));
router.use('/admin/game-categories', require('../modules/game-categories/game-categories.routes'));
router.use('/admin/game-sessions', require('../modules/game-sessions/game-sessions.routes'));

// ---- Admin panel: orders & chat ----
router.use('/admin/orders', require('../modules/orders/orders.routes'));
router.use('/admin/chat', require('../modules/chat/chat.routes'));

// ---- Admin panel: ecommerce ----
router.use('/admin/product-categories', require('../modules/product-categories/product-categories.routes'));
router.use('/admin/products', require('../modules/products/products.routes'));
router.use('/admin/packages', require('../modules/packages/packages.routes'));

// ---- Admin panel: get in touch + CMS ----
router.use('/admin/contact-messages', require('../modules/contact/contact.routes'));
router.use('/admin/cms', require('../modules/cms/cms.routes'));

// ---- Public (website) ----
router.use('/schools', require('../modules/schools/schools.public.routes'));
router.use('/game-categories', require('../modules/game-categories/game-categories.public.routes'));
router.use('/products', require('../modules/products/products.public.routes'));
router.use('/packages', require('../modules/packages/packages.public.routes'));
router.use('/contact-us', require('../modules/contact/contact.public.routes'));
router.use('/', require('../modules/cms/cms.public.routes'));

// Still to come: cart/checkout + payments, live game session play (Socket.io),
// social (follows) + real-time chat send. See docs/PROJECT_PLAN.md.

module.exports = router;
