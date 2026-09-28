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
// new_arrival is an alias for newest — there's no separate "flagged new"
// column, created_at is the only signal available for it.
const SORT_COLUMNS = {
  newest: 'created_at DESC',
  new_arrival: 'created_at DESC',
  oldest: 'created_at ASC',
  price_asc: 'base_price ASC',
  price_desc: 'base_price DESC',
  name_asc: 'name_en ASC',
  name_desc: 'name_en DESC',
};

// Sorts derived from real sales data (paid orders only), so they need a
// join instead of a static column — handled as a separate query path from
// SORT_COLUMNS. There's no page-view or wishlist tracking in this schema,
// so "popular" is defined as bought by the most distinct customers/orders,
// while "best_seller" is the most total units sold — two genuinely
// different rankings from the same order_items data, not aliases of the
// same thing.
const SALES_SORTS = {
  best_seller: 'unitsSold DESC',
  popular: 'orderCount DESC',
};

async function listActive({ page = 1, pageSize = 20, search = '', sort = '' } = {}) {
  // Built with a "p." prefix throughout (even though the non-join branch
  // below doesn't strictly need it) so the same where/params work
  // unchanged against both `FROM products` and the sales-sort branch's
  // `FROM products p ... JOIN`, instead of prefixing a whole compound
  // clause string (which would mangle the parenthesized search clause).
  const where = ['p.is_active = 1'];
  const params = [];

  if (search) {
    where.push('(p.name_en LIKE ? OR p.name_ar LIKE ? OR p.slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = where.join(' AND ');
  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM products p WHERE ${whereSql}`, params);

  let rows;
  if (SALES_SORTS[sort]) {
    const orderBy = SALES_SORTS[sort];
    [rows] = await pool.query(
      `SELECT p.*,
              COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) AS unitsSold,
              COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN oi.order_id END) AS orderCount
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id
       WHERE ${whereSql}
       GROUP BY p.id
       ORDER BY ${orderBy}, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
  } else {
    const [column, direction] = (SORT_COLUMNS[sort] || SORT_COLUMNS.newest).split(' ');
    [rows] = await pool.query(
      `SELECT p.* FROM products p WHERE ${whereSql} ORDER BY p.${column} ${direction} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
  }

  return { rows, total: countRows[0].total, page: Number(page) || 1, pageSize: limit };
}

// "Related" has no category/tag data to base itself on (products have no
// category concept — see migrate_remove_product_categories.sql), so this is
// a price-proximity proxy: other active products within +/-25% of this
// product's base_price, closest price first, excluding itself.
async function listRelated(product, limit = 8) {
  const price = Number(product.base_price);
  const min = price * 0.75;
  const max = price * 1.25;
  const [rows] = await pool.query(
    `SELECT *, ABS(base_price - ?) AS priceDiff
     FROM products
     WHERE is_active = 1 AND id != ? AND base_price BETWEEN ? AND ?
     ORDER BY priceDiff ASC
     LIMIT ?`,
    [price, product.id, min, max, limit]
  );
  return rows;
}

async function listVariants(productId) {
  const [rows] = await pool.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [productId]);
  return rows;
}

// A variant's attributes_json is a flat {typeSlug: "label or hex string"}
// map — generateVariants stores a color type's hex_color when set,
// otherwise its value_en (see migrate_variant_colors.sql), and the website
// renders that raw string directly as a color swatch. This is additive only
// — it resolves each stored value against the real variant_types/
// variant_type_values data and attaches a structured `attributes` array
// (ids, both language labels, hex color) alongside the untouched
// attributes_json, so a client doesn't have to guess whether a value is a
// color or plain text. Falls back to the raw string when nothing matches
// (a manually-added variant whose value doesn't correspond to any real
// variant_type_value, or a value that's since been deleted/edited).
async function resolveVariantAttributes(variants) {
  if (!variants.length) return variants;
  const [valueRows] = await pool.query(
    `SELECT vtv.id, vtv.value_en, vtv.value_ar, vtv.hex_color, vt.slug AS type_slug, vt.name_en AS type_name_en, vt.name_ar AS type_name_ar
     FROM variant_type_values vtv
     JOIN variant_types vt ON vt.id = vtv.variant_type_id`
  );

  return variants.map((variant) => {
    let raw = variant.attributes_json;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    raw = raw || {};

    const attributes = Object.entries(raw).map(([typeSlug, storedValue]) => {
      const match = valueRows.find(
        (v) => v.type_slug === typeSlug && (v.hex_color === String(storedValue) || v.value_en === storedValue)
      );
      const looksLikeHex = /^#[0-9a-f]{3,8}$/i.test(String(storedValue));
      return {
        typeSlug,
        typeNameEn: match ? match.type_name_en : null,
        typeNameAr: match ? match.type_name_ar : null,
        valueId: match ? match.id : null,
        valueEn: match ? match.value_en : String(storedValue),
        valueAr: match ? match.value_ar : String(storedValue),
        hexColor: match ? match.hex_color || null : looksLikeHex ? String(storedValue) : null,
      };
    });

    return { ...variant, attributes };
  });
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
  listRelated,
  resolveVariantAttributes,
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
