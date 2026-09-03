const repo = require('./follows.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

function publicUser(u) {
  return { id: u.id, fullName: u.full_name, avatarUrl: u.avatar_url, bio: u.bio };
}

const getProfile = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const user = await repo.findPublicUser(targetId);
  if (!user) throw ApiError.notFound('User not found');
  const [liveFollowersCount, liveFollowingCount, isFollowedByMe] = await Promise.all([
    repo.countFollowers(targetId),
    repo.countFollowing(targetId),
    req.user ? repo.isFollowing(req.user.id, targetId) : Promise.resolve(false),
  ]);
  // `users.followers_count`/`following_count` are an admin-set baseline
  // (used e.g. to seed a "special" user's profile so it doesn't look
  // brand new) layered underneath the real, live-counted `follows` rows —
  // the two are additive, not alternatives.
  const followersCount = (user.followers_count || 0) + liveFollowersCount;
  const followingCount = (user.following_count || 0) + liveFollowingCount;
  ok(res, { ...publicUser(user), followersCount, followingCount, isFollowedByMe, isMe: req.user?.id === targetId });
});

const followUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) throw ApiError.badRequest("You can't follow yourself");
  const target = await repo.findPublicUser(targetId);
  if (!target) throw ApiError.notFound('User not found');
  await repo.follow(req.user.id, targetId);
  ok(res, { following: true }, 'Followed');
});

const unfollowUser = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  await repo.unfollow(req.user.id, targetId);
  ok(res, { following: false }, 'Unfollowed');
});

// Remove someone who follows ME from my followers list (the reverse
// direction of unfollowUser — they keep following whoever else they like,
// this just deletes the follows row where they follow *me*).
const removeFollower = asyncHandler(async (req, res) => {
  const followerId = Number(req.params.followerId);
  await repo.unfollow(followerId, req.user.id);
  ok(res, { removed: true }, 'Follower removed');
});

function withFollowedAt(row) {
  return { ...publicUser(row), followedAt: row.followed_at };
}

const listFollowers = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await repo.listFollowers(Number(req.params.id), { page, pageSize });
  const followedIds = req.user ? await repo.isFollowingBulk(req.user.id, result.rows.map((r) => r.id)) : new Set();
  ok(res, { ...result, rows: result.rows.map((row) => ({ ...withFollowedAt(row), isFollowedByMe: followedIds.has(row.id) })) });
});

const listFollowing = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await repo.listFollowing(Number(req.params.id), { page, pageSize });
  ok(res, { ...result, rows: result.rows.map(withFollowedAt) });
});

// "Discover Players" search — every active user except the viewer, optionally
// filtered by name. Available to guests too (optionalAuth), just without the
// per-row `isFollowedByMe` flag since there's no viewer to check against.
const searchUsers = asyncHandler(async (req, res) => {
  const { search, page, pageSize } = req.query;
  const result = await repo.searchUsers(search, req.user?.id, { page, pageSize });
  const followedIds = req.user ? await repo.isFollowingBulk(req.user.id, result.rows.map((r) => r.id)) : new Set();
  ok(res, { ...result, rows: result.rows.map((row) => ({ ...publicUser(row), isFollowedByMe: followedIds.has(row.id) })) });
});

module.exports = { getProfile, followUser, unfollowUser, removeFollower, listFollowers, listFollowing, searchUsers };
