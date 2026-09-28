const { pool } = require('../../config/db');
const { makeCrudRepository } = require('../../utils/crudFactory');

const base = makeCrudRepository({ table: 'products', searchableColumns: ['name_en', 'name_ar', 'slug'] });

async function findBySlug(slug) {
  const [rows] = await pool.query('SELECT * FROM products WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
  return rows[0] || null;
}

// ?sort= values the storefront/app can send. Sorting by price uses
// base_price, not offer_price — offer_price is an optional discount
// overlay (nullable), not a reliable ranking value on its own.
const SORT_COLUMNS = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  price_asc: 'base_price ASC',
  price_desc: 'base_price DESC',
  name_asc: 'name_en ASC',
  name_desc: 'name_en DESC',
};

async function listActive({ page = 1, pageSize = 20, search = '', sort = '' } = {}) {
  const where = ['is_active = 1'];
  const params = [];

  if (search) {
    where.push('(name_en LIKE ? OR name_ar LIKE ? OR slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const orderBy = SORT_COLUMNS[sort] || SORT_COLUMNS.newest;
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
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

async function findImageById(id) {
  const [rows] = await pool.query('SELECT * FROM product_images WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createImage(productId, { imageUrl, sortOrder }) {
  const [countRows] = await pool.query('SELECT COUNT(*) as total FROM product_images WHERE product_id = ?', [productId]);
  const nextSort = sortOrder ?? countRows[0].total;
  const [result] = await pool.query(
    'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
    [productId, imageUrl, nextSort]
  );
  return findImageById(result.insertId);
}

async function deleteImage(id) {
  await pool.query('DELETE FROM product_images WHERE id = ?', [id]);
}

async function findVariantById(id) {
  const [rows] = await pool.query('SELECT * FROM product_variants WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function findVariantBySku(sku) {
  const [rows] = await pool.query('SELECT * FROM product_variants WHERE sku = ? LIMIT 1', [sku]);
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
  findImageById,
  createImage,
  deleteImage,
  findVariantById,
  findVariantBySku,
  createVariant,
  updateVariant,
  deleteVariant,
};
