const { pool } = require('../../config/db');

// ---- profile ----

async function updateProfile(userId, data) {
  if (Object.keys(data).length) {
    await pool.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
  }
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

// ---- addresses ----

async function listAddresses(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId]
  );
  return rows;
}

async function findAddressById(id) {
  const [rows] = await pool.query('SELECT * FROM addresses WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createAddress(userId, data) {
  const [result] = await pool.query('INSERT INTO addresses SET ?', [{ ...data, user_id: userId }]);
  return findAddressById(result.insertId);
}

async function updateAddress(id, data) {
  if (Object.keys(data).length) {
    await pool.query('UPDATE addresses SET ? WHERE id = ?', [data, id]);
  }
  return findAddressById(id);
}

async function deleteAddress(id) {
  await pool.query('DELETE FROM addresses WHERE id = ?', [id]);
}

async function clearDefaultAddress(userId) {
  await pool.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
}

// ---- my orders (product purchases) ----

async function listMyOrders(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM orders WHERE user_id = ?', [userId]);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function findMyOrder(userId, orderId) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1', [orderId, userId]);
  return rows[0] || null;
}

async function listOrderItems(orderId) {
  const [rows] = await pool.query(
    `SELECT oi.*, p.thumbnail_url, pv.attributes_json
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return rows;
}

// ---- game history ----

// Sessions the user took part in, most recent first — grouped with every
// other participant/team in that same session, the quizzes/categories that
// were played, and which lifelines were used, so the frontend can render one
// card per session (not one row per participant) with a real win/lose call.
async function listGameHistory(userId, { page = 1, pageSize = 20 } = {}) {
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [sessionRows] = await pool.query(
    `SELECT DISTINCT gs.id AS session_id, gs.mode, gs.status, gs.started_at, gs.ended_at, gs.created_at
     FROM game_participants gp
     JOIN game_sessions gs ON gs.id = gp.session_id
     WHERE gp.user_id = ?
     ORDER BY gs.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT gs.id) AS total FROM game_participants gp JOIN game_sessions gs ON gs.id = gp.session_id WHERE gp.user_id = ?`,
    [userId]
  );

  const sessionIds = sessionRows.map((r) => r.session_id);
  if (!sessionIds.length) {
    return { rows: [], total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
  }

  const [participants] = await pool.query(
    `SELECT gp.id, gp.session_id, gp.user_id, gp.guest_name, gp.team_id, gp.score,
            u.full_name, u.avatar_url
     FROM game_participants gp
     LEFT JOIN users u ON u.id = gp.user_id
     WHERE gp.session_id IN (?)
     ORDER BY gp.score DESC`,
    [sessionIds]
  );
  const [teams] = await pool.query(
    `SELECT id, session_id, name, color, score FROM game_teams WHERE session_id IN (?) ORDER BY score DESC`,
    [sessionIds]
  );
  const [quizzes] = await pool.query(
    `SELECT gsc.session_id, q.id, q.title_en, q.title_ar, q.cover_image_url
     FROM game_session_categories gsc
     JOIN quizzes q ON q.id = gsc.quiz_id
     WHERE gsc.session_id IN (?)
     ORDER BY gsc.sort_order`,
    [sessionIds]
  );
  const participantIds = participants.map((p) => p.id);
  const [lifelines] = participantIds.length
    ? await pool.query(
        `SELECT session_id, lifeline_type FROM game_lifeline_usage WHERE session_id IN (?)`,
        [sessionIds]
      )
    : [[]];

  const rows = sessionRows.map((session) => {
    const sessionParticipants = participants.filter((p) => p.session_id === session.session_id);
    const sessionTeams = teams.filter((t) => t.session_id === session.session_id);
    const topParticipantScore = sessionParticipants.length ? Math.max(...sessionParticipants.map((p) => p.score)) : null;
    const topTeamScore = sessionTeams.length ? Math.max(...sessionTeams.map((t) => t.score)) : null;

    return {
      sessionId: session.session_id,
      mode: session.mode,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      participants: session.mode === 'team' ? [] : sessionParticipants.map((p) => ({
        id: p.id,
        userId: p.user_id,
        name: p.full_name || p.guest_name || 'Player',
        avatarUrl: p.avatar_url,
        score: p.score,
        isWinner: topParticipantScore !== null && p.score === topParticipantScore,
      })),
      teams: session.mode === 'team' ? sessionTeams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        score: t.score,
        isWinner: topTeamScore !== null && t.score === topTeamScore,
        members: sessionParticipants.filter((p) => p.team_id === t.id).map((p) => ({
          id: p.id,
          userId: p.user_id,
          name: p.full_name || p.guest_name || 'Player',
          avatarUrl: p.avatar_url,
        })),
      })) : [],
      quizzes: quizzes.filter((q) => q.session_id === session.session_id).map((q) => ({
        id: q.id,
        titleEn: q.title_en,
        titleAr: q.title_ar,
        coverImageUrl: q.cover_image_url,
      })),
      lifelinesUsed: [...new Set(lifelines.filter((l) => l.session_id === session.session_id).map((l) => l.lifeline_type))],
    };
  });

  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

module.exports = {
  updateProfile,
  listAddresses,
  findAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  clearDefaultAddress,
  listMyOrders,
  findMyOrder,
  listOrderItems,
  listGameHistory,
};
