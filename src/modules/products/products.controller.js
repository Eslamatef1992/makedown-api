const repo = require('./products.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');
const { slugify, ensureUniqueSlug } = require('../../utils/slugify');
const variantTypesRepo = require('../variant-types/variant-types.repository');

async function transformInput(body, { isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  if (body.slug !== undefined) data.slug = body.slug;
  mapBilingualField(body, data, 'description', 'description');
  if (body.basePrice !== undefined) data.base_price = body.basePrice;
  // Offer price is optional — an explicit empty value clears it back to
  // "no offer" rather than being silently ignored on an edit.
  if (body.offerPrice !== undefined) data.offer_price = body.offerPrice === '' ? null : body.offerPrice;
  // Stock quantity left blank means "not tracked" (always purchasable),
  // same as every product's behavior before this field existed — only an
  // admin who explicitly sets a number turns on the out-of-stock check.
  if (body.quantity !== undefined) data.stock_quantity = body.quantity === '' ? null : body.quantity;
  if (body.hasGiftBox !== undefined) data.has_gift_box = body.hasGiftBox ? 1 : 0;
  if (body.giftBoxPrice !== undefined) data.gift_box_price = body.giftBoxPrice === '' ? null : body.giftBoxPrice;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.thumbnailUrl !== undefined) data.thumbnail_url = body.thumbnailUrl;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  if (!isUpdate && !data.slug) {
    data.slug = await ensureUniqueSlug(repo, slugify(data.name_en || 'product'));
  }
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Product not found' });

const getOneWithVariants = asyncHandler(async (req, res) => {
  const product = await repo.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const [variants, images] = await Promise.all([repo.listVariants(req.params.id), repo.listImages(req.params.id)]);
  ok(res, { ...product, variants, images });
});

const addVariant = asyncHandler(async (req, res) => {
  const product = await repo.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const b = req.body;
  if (b.price === undefined || b.price === null || b.price === '') {
    throw ApiError.badRequest('Price is required');
  }

  // SKU has a UNIQUE constraint — an admin leaving it blank (or reusing one)
  // used to 500 on the second attempt. Auto-generate one from the product's
  // slug when it's left blank, same as the "Generate variants" flow does.
  let sku = (b.sku || '').trim();
  if (!sku) {
    sku = `${product.slug}-${Date.now().toString(36)}`.toUpperCase();
  }

  try {
    const variant = await repo.createVariant(req.params.id, {
      sku,
      attributes_json: JSON.stringify(b.attributes || {}),
      price: b.price,
      compare_at_price: b.compareAtPrice || null,
      stock_quantity: b.stockQuantity ?? 0,
      is_active: b.isActive === false ? 0 : 1,
    });
    created(res, variant);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw ApiError.badRequest('That SKU is already in use by another variant.');
    }
    throw err;
  }
});

const updateVariant = asyncHandler(async (req, res) => {
  const existing = await repo.findVariantById(req.params.variantId);
  if (!existing) throw ApiError.notFound('Variant not found');
  const b = req.body;
  const data = {};
  if (b.sku !== undefined && b.sku.trim()) data.sku = b.sku.trim();
  if (b.attributes !== undefined) data.attributes_json = JSON.stringify(b.attributes);
  if (b.price !== undefined) data.price = b.price;
  if (b.compareAtPrice !== undefined) data.compare_at_price = b.compareAtPrice;
  if (b.stockQuantity !== undefined) data.stock_quantity = b.stockQuantity;
  if (b.isActive !== undefined) data.is_active = b.isActive ? 1 : 0;
  try {
    const variant = await repo.updateVariant(req.params.variantId, data);
    ok(res, variant, 'Updated');
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw ApiError.badRequest('That SKU is already in use by another variant.');
    }
    throw err;
  }
});

const deleteVariant = asyncHandler(async (req, res) => {
  const existing = await repo.findVariantById(req.params.variantId);
  if (!existing) throw ApiError.notFound('Variant not found');
  await repo.deleteVariant(req.params.variantId);
  ok(res, null, 'Deleted');
});

function slugifyValue(input) {
  return (
    String(input || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'x'
  );
}

function cartesian(arrays) {
  return arrays.reduce((acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])), [[]]);
}

// Generates one product_variants row per combination of the selected variant
// type values (e.g. Color x Width), skipping combinations that already exist
// for this product so the endpoint is safe to re-run after adding new values.
const generateVariants = asyncHandler(async (req, res) => {
  const product = await repo.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const b = req.body;
  const selections = Array.isArray(b.selections) ? b.selections : [];
  if (b.price === undefined || b.price === null || b.price === '') {
    throw ApiError.badRequest('Price is required');
  }

  const resolvedGroups = [];
  for (const sel of selections) {
    const type = await variantTypesRepo.findById(sel.typeId);
    if (!type) throw ApiError.badRequest(`Variant type ${sel.typeId} not found`);
    const valueIds = Array.isArray(sel.valueIds) ? sel.valueIds : [];
    if (!valueIds.length) continue;
    const values = await variantTypesRepo.findValuesByIds(valueIds);
    if (!values.length) continue;
    resolvedGroups.push({ type, values });
  }
  if (!resolvedGroups.length) {
    throw ApiError.badRequest('Select at least one variant type with at least one value');
  }

  const combos = cartesian(resolvedGroups.map((g) => g.values.map((v) => ({ typeSlug: g.type.slug, ...v }))));

  const existingVariants = await repo.listVariants(req.params.id);
  const existingSignatures = new Set(
    existingVariants.map((v) => {
      let attrs = {};
      try {
        attrs = typeof v.attributes_json === 'string' ? JSON.parse(v.attributes_json) : v.attributes_json || {};
      } catch {
        attrs = {};
      }
      return JSON.stringify(Object.entries(attrs).sort());
    })
  );

  const createdVariants = [];
  let skippedCount = 0;

  for (const combo of combos) {
    const attributes = {};
    const skuParts = [product.slug];
    combo.forEach((v) => {
      // A color-type value with a picked hex swatch stores the hex as the
      // attribute so the website's `style={{ backgroundColor: ... }}`
      // swatches render the real picked color instead of the text label.
      attributes[v.typeSlug] = v.hex_color || v.value_en;
      skuParts.push(slugifyValue(v.value_en));
    });
    const signature = JSON.stringify(Object.entries(attributes).sort());
    if (existingSignatures.has(signature)) {
      skippedCount += 1;
      continue;
    }

    let sku = skuParts.join('-').toUpperCase();
    let suffix = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await repo.findVariantBySku(sku)) {
      sku = `${skuParts.join('-').toUpperCase()}-${suffix}`;
      suffix += 1;
    }

    // eslint-disable-next-line no-await-in-loop
    const variant = await repo.createVariant(req.params.id, {
      sku,
      attributes_json: JSON.stringify(attributes),
      price: b.price,
      compare_at_price: b.compareAtPrice || null,
      stock_quantity: b.stockQuantity ?? 0,
      is_active: 1,
    });
    createdVariants.push(variant);
    existingSignatures.add(signature);
  }

  ok(
    res,
    { created: createdVariants, createdCount: createdVariants.length, skippedCount },
    createdVariants.length ? `Generated ${createdVariants.length} variant(s)` : 'No new variants — all combinations already exist'
  );
});

// ---- public ----

const publicList = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await repo.listActive({ page, pageSize });
  ok(res, result);
});

const publicGetBySlug = asyncHandler(async (req, res) => {
  const product = await repo.findBySlug(req.params.slug);
  if (!product) throw ApiError.notFound('Product not found');
  const [variants, images] = await Promise.all([repo.listVariants(product.id), repo.listImages(product.id)]);
  ok(res, { ...product, variants: variants.filter((v) => v.is_active), images });
});

// ---- images (product gallery) ----

const addImage = asyncHandler(async (req, res) => {
  const product = await repo.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const b = req.body;
  if (!b.imageUrl) throw ApiError.badRequest('imageUrl is required');
  const image = await repo.createImage(req.params.id, { imageUrl: b.imageUrl, sortOrder: b.sortOrder });
  created(res, image);
});

const deleteImage = asyncHandler(async (req, res) => {
  const existing = await repo.findImageById(req.params.imageId);
  if (!existing || String(existing.product_id) !== String(req.params.id)) {
    throw ApiError.notFound('Image not found');
  }
  await repo.deleteImage(req.params.imageId);
  ok(res, null, 'Deleted');
});

module.exports = {
  ...crud,
  getOneWithVariants,
  addVariant,
  updateVariant,
  deleteVariant,
  generateVariants,
  publicList,
  publicGetBySlug,
  addImage,
  deleteImage,
};
