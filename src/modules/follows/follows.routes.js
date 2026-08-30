const router = require('express').Router();
const controller = require('./follows.controller');
const requireAuth = require('../../middlewares/auth.middleware');
const optionalAuth = require('../../middlewares/optionalAuth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Social
 *     description: Public user profiles, follow / unfollow, followers and following lists
 * /users/{id}:
 *   get:
 *     tags: [Social]
 *     summary: Get a user's public profile (with follower/following counts)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Public profile } }
 * /users/{id}/follow:
 *   post:
 *     tags: [Social]
 *     summary: Follow a user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Followed } }
 *   delete:
 *     tags: [Social]
 *     summary: Unfollow a user
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Unfollowed } }
 * /users/{id}/followers:
 *   get:
 *     tags: [Social]
 *     summary: List a user's followers
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Paginated list } }
 * /users/{id}/following:
 *   get:
 *     tags: [Social]
 *     summary: List who a user is following
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Paginated list } }
 */
router.get('/:id', optionalAuth, controller.getProfile);
router.post('/:id/follow', requireAuth, controller.followUser);
router.delete('/:id/follow', requireAuth, controller.unfollowUser);
router.get('/:id/followers', controller.listFollowers);
router.get('/:id/following', controller.listFollowing);

module.exports = router;
