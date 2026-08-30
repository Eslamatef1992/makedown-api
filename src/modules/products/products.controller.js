const repo = require('./products.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  if (body.categoryId !== undefined) data.category_id = body.categoryId || null;
  mapBilingualField(body, data, 'name', 'name');
  if (body.slug !== undefined) data.slug = body.slug;
  mapBilingualField(body, data, 'description', 'description');
  if (body.basePrice !== undefined) data.base_price = body.basePrice;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.thumbnailUrl !== undefined) data.thumbnail_url = body.thumbnailUrl;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
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
  const variant = await repo.createVariant(req.params.id, {
    sku: b.sku,
    attributes_json: JSON.stringify(b.attributes || {}),
    price: b.price,
    compare_at_price: b.compareAtPrice || null,
    stock_quantity: b.stockQuantity ?? 0,
    is_active: b.isActive === false ? 0 : 1,
  });
  created(res, variant);
});

const updateVariant = asyncHandler(async (req, res) => {
  const existing = await repo.findVariantById(req.params.variantId);
  if (!existing) throw ApiError.notFound('Variant not found');
  const b = req.body;
  const data = {};
  if (b.sku !== undefined) data.sku = b.sku;
  if (b.attributes !== undefined) data.attributes_json = JSON.stringify(b.attributes);
  if (b.price !== undefined) data.price = b.price;
  if (b.compareAtPrice !== undefined) data.compare_at_price = b.compareAtPrice;
  if (b.stockQuantity !== undefined) data.stock_quantity = b.stockQuantity;
  if (b.isActive !== undefined) data.is_active = b.isActive ? 1 : 0;
  const variant = await repo.updateVariant(req.params.variantId, data);
  ok(res, variant, 'Updated');
});

const deleteVariant = asyncHandler(async (req, res) => {
  const existing = await repo.findVariantById(req.params.variantId);
  if (!existing) throw ApiError.notFound('Variant not found');
  await repo.deleteVariant(req.params.variantId);
  ok(res, null, 'Deleted');
});

// ---- public ----

const publicList = asyncHandler(async (req, res) => {
  const { page, pageSize, categoryId } = req.query;
  const result = await repo.listActive({ page, pageSize, categoryId });
  ok(res, result);
});

const publicGetBySlug = asyncHandler(async (req, res) => {
  const product = await repo.findBySlug(req.params.slug);
  if (!product) throw ApiError.notFound('Product not found');
  const [variants, images] = await Promise.all([repo.listVariants(product.id), repo.listImages(product.id)]);
  ok(res, { ...product, variants: variants.filter((v) => v.is_active), images });
});

module.exports = { ...crud, getOneWithVariants, addVariant, updateVariant, deleteVariant, publicList, publicGetBySlug };
