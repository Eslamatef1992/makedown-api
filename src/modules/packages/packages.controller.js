const repo = require('./packages.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  mapBilingualField(body, data, 'description', 'description');
  if (body.price !== undefined) data.price = body.price;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.credits !== undefined) data.credits = body.credits;
  if (body.validityDays !== undefined) data.validity_days = body.validityDays;
  if (body.sortOrder !== undefined) data.sort_order = body.sortOrder;
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Package not found' });

const publicList = asyncHandler(async (req, res) => {
  ok(res, await repo.listActive());
});

module.exports = { ...crud, publicList };
