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
  const [followersCount, followingCount, isFollowedByMe] = await Promise.all([
    repo.countFollowers(targetId),
    repo.countFollowing(targetId),
    req.user ? repo.isFollowing(req.user.id, targetId) : Promise.resolve(false),
  ]);
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

function withFollowedAt(row) {
  return { ...publicUser(row), followedAt: row.followed_at };
}

const listFollowers = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await repo.listFollowers(Number(req.params.id), { page, pageSize });
  ok(res, { ...result, rows: result.rows.map(withFollowedAt) });
});

const listFollowing = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await repo.listFollowing(Number(req.params.id), { page, pageSize });
  ok(res, { ...result, rows: result.rows.map(withFollowedAt) });
});

module.exports = { getProfile, followUser, unfollowUser, listFollowers, listFollowing };
