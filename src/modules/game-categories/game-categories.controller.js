const repo = require('./game-categories.repository');
const { makeCrudController } = require('../../utils/crudController');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  if (body.parentId !== undefined) data.parent_id = body.parentId || null;
  mapBilingualField(body, data, 'name', 'name');
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.iconUrl !== undefined) data.icon_url = body.iconUrl;
  if (body.sortOrder !== undefined) data.sort_order = body.sortOrder;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  return data;
}

module.exports = makeCrudController(repo, { transformInput, notFoundMessage: 'Category not found' });
