const repo = require('./game-categories.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');
const { slugify, ensureUniqueSlug } = require('../../utils/slugify');

async function transformInput(body, { isUpdate } = {}) {
  const data = {};
  if (body.parentId !== undefined) data.parent_id = body.parentId || null;
  mapBilingualField(body, data, 'name', 'name');
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.iconUrl !== undefined) data.icon_url = body.iconUrl;
  if (body.sortOrder !== undefined) data.sort_order = body.sortOrder;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  if (!isUpdate && !data.slug) {
    data.slug = await ensureUniqueSlug(repo, slugify(data.name_en || 'category'));
  }
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Category not found' });

// Overrides the generic list() so each row also carries quiz_count (see
// repo.listWithGameCounts) — the admin table uses it to show a "Has Games"
// column alongside the inline Active toggle.
const list = asyncHandler(async (req, res) => {
  const { page, pageSize, search } = req.query;
  const result = await repo.listWithGameCounts({ page, pageSize, search });
  ok(res, result);
});

module.exports = { ...crud, list };
