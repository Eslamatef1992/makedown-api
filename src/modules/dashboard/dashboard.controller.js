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

module.exports = { stats };
