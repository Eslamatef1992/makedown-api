const { pool } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');

const stats = asyncHandler(async (req, res) => {
  const queries = {
    totalUsers: 'SELECT COUNT(*) AS n FROM users',
    specialUsers: 'SELECT COUNT(*) AS n FROM users WHERE is_special = 1',
    totalSchools: 'SELECT COUNT(*) AS n FROM schools WHERE is_active = 1',
    totalProducts: 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1',
    totalOrders: 'SELECT COUNT(*) AS n FROM orders',
    guestOrders: 'SELECT COUNT(*) AS n FROM orders WHERE user_id IS NULL',
    pendingOrders: "SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'",
    revenue: "SELECT COALESCE(SUM(grand_total), 0) AS n FROM orders WHERE payment_status = 'paid'",
    activeGameSessions: "SELECT COUNT(*) AS n FROM game_sessions WHERE status IN ('waiting', 'active')",
    totalQuizzes: 'SELECT COUNT(*) AS n FROM quizzes WHERE is_active = 1',
    newContactMessages: "SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'",
    totalPackagesSold: 'SELECT COUNT(*) AS n FROM user_packages',
    totalGameCategories: 'SELECT COUNT(*) AS n FROM game_categories WHERE is_active = 1',
    totalPackages: 'SELECT COUNT(*) AS n FROM packages WHERE is_active = 1',
    totalAdmins: 'SELECT COUNT(*) AS n FROM admins WHERE is_active = 1',
    totalFaqs: 'SELECT COUNT(*) AS n FROM faqs WHERE is_active = 1',
  };

  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, sql]) => {
      const [rows] = await pool.query(sql);
      return [key, rows[0].n];
    })
  );

  ok(res, Object.fromEntries(entries));
});

// Best-selling products by units sold (excludes cancelled orders so a
// scrapped order never counts as a "sale"). product_name_snapshot covers
// products that were later deleted/renamed -- the sale still happened.
const topProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
  const [rows] = await pool.query(
    `SELECT
       oi.product_id AS id,
       COALESCE(p.name_en, oi.product_name_snapshot) AS name_en,
       p.name_ar AS name_ar,
       p.thumbnail_url AS thumbnail_url,
       SUM(oi.quantity) AS qty_sold,
       SUM(oi.line_total) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status <> 'cancelled'
     GROUP BY oi.product_id, oi.product_name_snapshot, p.name_en, p.name_ar, p.thumbnail_url
     ORDER BY qty_sold DESC
     LIMIT ?`,
    [limit]
  );
  ok(res, rows);
});

// Game categories ranked by how many active quizzes they hold -- a proxy
// for how built-out/popular a category is in the game catalog.
const topCategories = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
  const [rows] = await pool.query(
    `SELECT
       gc.id, gc.name_en, gc.name_ar, gc.icon_url,
       COUNT(q.id) AS quiz_count
     FROM game_categories gc
     LEFT JOIN quizzes q ON q.category_id = gc.id AND q.is_active = 1
     WHERE gc.is_active = 1
     GROUP BY gc.id, gc.name_en, gc.name_ar, gc.icon_url
     ORDER BY quiz_count DESC, gc.sort_order ASC
     LIMIT ?`,
    [limit]
  );
  ok(res, rows);
});

// Fills in zero-value days so the frontend chart doesn't need to guess at
// gaps -- every day in the window is present even with no rows in the DB.
function fillDailySeries(rows, days, valueKey) {
  const byDate = new Map(rows.map((r) => [String(r.d), Number(r[valueKey]) || 0]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: byDate.get(key) || 0 });
  }
  return out;
}

// Daily revenue from paid orders over the trailing window (default 30 days).
const salesSeries = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS d, COALESCE(SUM(grand_total), 0) AS revenue
     FROM orders
     WHERE payment_status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)`,
    [days - 1]
  );
  ok(res, fillDailySeries(rows, days, 'revenue'));
});

// Daily new-user signups over the trailing window (default 30 days).
const newUsersSeries = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS d, COUNT(*) AS n
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)`,
    [days - 1]
  );
  ok(res, fillDailySeries(rows, days, 'n'));
});

module.exports = { stats, topProducts, topCategories, salesSeries, newUsersSeries };
