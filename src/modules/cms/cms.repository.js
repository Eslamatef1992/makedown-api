const { pool } = require('../../config/db');

// ---- pages ----
async function listPages() {
  const [rows] = await pool.query('SELECT * FROM cms_pages ORDER BY slug ASC');
  return rows;
}
async function findPageBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM cms_pages WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}
async function updatePage(slug, data) {
  await pool.query('UPDATE cms_pages SET ? WHERE slug = ?', [data, slug]);
  return findPageBySlug(slug);
}

// ---- faqs ----
async function listFaqs() {
  const [rows] = await pool.query('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC');
  return rows;
}
async function findFaqById(id) {
  const [rows] = await pool.query('SELECT * FROM faqs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
async function createFaq(data) {
  const [result] = await pool.query('INSERT INTO faqs SET ?', [data]);
  return findFaqById(result.insertId);
}
async function updateFaq(id, data) {
  await pool.query('UPDATE faqs SET ? WHERE id = ?', [data, id]);
  return findFaqById(id);
}
async function deleteFaq(id) {
  await pool.query('DELETE FROM faqs WHERE id = ?', [id]);
}

// ---- social links ----
async function listSocialLinks() {
  const [rows] = await pool.query('SELECT * FROM social_links ORDER BY sort_order ASC, id ASC');
  return rows;
}
async function findSocialLinkById(id) {
  const [rows] = await pool.query('SELECT * FROM social_links WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
async function createSocialLink(data) {
  const [result] = await pool.query('INSERT INTO social_links SET ?', [data]);
  return findSocialLinkById(result.insertId);
}
async function updateSocialLink(id, data) {
  await pool.query('UPDATE social_links SET ? WHERE id = ?', [data, id]);
  return findSocialLinkById(id);
}
async function deleteSocialLink(id) {
  await pool.query('DELETE FROM social_links WHERE id = ?', [id]);
}

module.exports = {
  listPages, findPageBySlug, updatePage,
  listFaqs, findFaqById, createFaq, updateFaq, deleteFaq,
  listSocialLinks, findSocialLinkById, createSocialLink, updateSocialLink, deleteSocialLink,
};
