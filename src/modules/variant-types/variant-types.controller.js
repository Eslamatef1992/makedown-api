const repo = require('./variant-types.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');
const { slugify, ensureUniqueSlug } = require('../../utils/slugify');

async function transformInput(body, { isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  if (!isUpdate && !data.slug) {
    data.slug = await ensureUniqueSlug(repo, slugify(data.name_en || 'variant-type'));
  }
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Variant type not found' });

const listWithValues = asyncHandler(async (req, res) => {
  const rows = await repo.listAllWithValues();
  ok(res, rows);
});

const addValue = asyncHandler(async (req, res) => {
  const type = await repo.findById(req.params.id);
  if (!type) throw ApiError.notFound('Variant type not found');
  const b = req.body;
  if (!b.valueEn || !b.valueAr) throw ApiError.badRequest('Both English and Arabic value are required');
  const value = await repo.createValue(req.params.id, {
    value_en: b.valueEn,
    value_ar: b.valueAr,
    sort_order: b.sortOrder ?? 0,
  });
  created(res, value);
});

const updateValue = asyncHandler(async (req, res) => {
  const existing = await repo.findValueById(req.params.valueId);
  if (!existing) throw ApiError.notFound('Value not found');
  const b = req.body;
  const data = {};
  if (b.valueEn !== undefined) data.value_en = b.valueEn;
  if (b.valueAr !== undefined) data.value_ar = b.valueAr;
  if (b.sortOrder !== undefined) data.sort_order = b.sortOrder;
  const value = await repo.updateValue(req.params.valueId, data);
  ok(res, value, 'Updated');
});

const deleteValue = asyncHandler(async (req, res) => {
  const existing = await repo.findValueById(req.params.valueId);
  if (!existing) throw ApiError.notFound('Value not found');
  await repo.deleteValue(req.params.valueId);
  ok(res, null, 'Deleted');
});

module.exports = { ...crud, listWithValues, addValue, updateValue, deleteValue };
