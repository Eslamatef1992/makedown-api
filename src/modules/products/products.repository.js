const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'products', searchableColumns: ['name_en', 'name_ar', 'slug'] });

async function findBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM products WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
  return rows[0] || null;
}

async function listActive({ page = 1, pageSize = 20, categoryId } = {}) {
  const where = ['is_active = 1'];
  const params = [];
  if (categoryId) { where.push('category_id = ?'); params.push(categoryId); }
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM products WHERE ${where.join(' AND ')}`, params);
  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

async function listVariants(productId) {
  const [rows] = await pool.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [productId]);
  return rows;
}

async function listImages(productId) {
  const [rows] = await pool.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [productId]);
  return rows;
}

async function findVariantById(id) {
  const [rows] = await pool.query('SELECT * FROM product_variants WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createVariant(productId, data) {
  const [result] = await pool.query('INSERT INTO product_variants SET ?', [{ ...data, product_id: productId }]);
  return findVariantById(result.insertId);
}

async function updateVariant(id, data) {
  await pool.query('UPDATE product_variants SET ? WHERE id = ?', [data, id]);
  return findVariantById(id);
}

async function deleteVariant(id) {
  await pool.query('DELETE FROM product_variants WHERE id = ?', [id]);
}

module.exports = {
  ...base,
  findBySlug,
  listActive,
  listVariants,
  listImages,
  findVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
};
