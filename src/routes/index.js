const router = require('express').Router();

const authRoutes = require('../modules/auth/auth.routes');

router.use('/auth', authRoutes);

// Future modules mount here as they're built:
// router.use('/products', require('../modules/products/products.routes'));
// router.use('/cart', require('../modules/cart/cart.routes'));
// router.use('/orders', require('../modules/orders/orders.routes'));
// router.use('/packages', require('../modules/packages/packages.routes'));
// router.use('/schools', require('../modules/schools/schools.routes'));
// router.use('/games', require('../modules/games/games.routes'));
// router.use('/social', require('../modules/social/social.routes'));
// router.use('/chat', require('../modules/chat/chat.routes'));
// router.use('/cms', require('../modules/cms/cms.routes'));
// router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
