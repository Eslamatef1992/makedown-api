const repo = require('./schools.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const { mapBilingualField, requireBilingual } = require('../../utils/bilingual');

function transformInput(body, { isUpdate } = {}) {
  const data = {};
  mapBilingualField(body, data, 'name', 'name');
  ['code', 'logoUrl', 'address', 'contactEmail', 'contactPhone'].forEach((k) => {
    if (body[k] !== undefined) data[{ logoUrl: 'logo_url', contactEmail: 'contact_email', contactPhone: 'contact_phone' }[k] || k] = body[k];
  });
  if (body.isActive !== undefined) data.is_active = body.isActive ? 1 : 0;
  requireBilingual(data, ['name'], isUpdate);
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'School not found' });

// Public — used by the website's "enter school game code" flow.
const verifyCode = asyncHandler(async (req, res) => {
  const school = await repo.findByCode(req.params.code);
  if (!school) throw ApiError.notFound('Invalid school code');
  ok(res, { id: school.id, nameEn: school.name_en, nameAr: school.name_ar, logoUrl: school.logo_url });
});

// Public — the website's "Schools" browsing grid.
const publicList = asyncHandler(async (req, res) => {
  const schools = await repo.listActive();
  ok(res, schools.map((s) => ({ id: s.id, nameEn: s.name_en, nameAr: s.name_ar, logoUrl: s.logo_url })));
});

module.exports = { ...crud, verifyCode, publicList };
