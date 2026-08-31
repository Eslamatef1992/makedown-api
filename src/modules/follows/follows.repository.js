const { pool } = require('../../config/db');

async function findPublicUser(id) {
  const [rows] = await pool.query(
    'SELECT id, full_name, avatar_url, bio, created_at, followers_count, following_count FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

// Which of `targetIds` does `viewerId` already follow? Used to decide, per
// row in someone's followers/following list, whether to show "Follow" or
// "Remove"/"Unfollow" for the viewer.
async function isFollowingBulk(viewerId, targetIds) {
  if (!viewerId || !targetIds.length) return new Set();
  const [rows] = await pool.query('SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (?)', [viewerId, targetIds]);
  return new Set(rows.map((r) => r.following_id));
}

async function isFollowing(followerId, followingId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
    [followerId, followingId]
  );
  return rows.length > 0;
}

async function follow(followerId, followingId) {
  await pool.query('INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', [followerId, followingId]);
}

async function unfollow(followerId, followingId) {
  await pool.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
}

async function countFollowers(userId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM follows WHERE following_id = ?', [userId]);
  return rows[0].total;
}

async function countFollowing(userId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?', [userId]);
  return rows[0].total;
}

async function listFollowers(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.avatar_url, u.bio, f.created_at AS followed_at
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ? AND u.is_active = 1
     ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const total = await countFollowers(userId);
  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

async function listFollowing(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.avatar_url, u.bio, f.created_at AS followed_at
     FROM follows f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? AND u.is_active = 1
     ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const total = await countFollowing(userId);
  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

module.exports = {
  findPublicUser,
  isFollowing,
  isFollowingBulk,
  follow,
  unfollow,
  countFollowers,
  countFollowing,
  listFollowers,
  listFollowing,
};
