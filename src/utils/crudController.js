const asyncHandler = require('./asyncHandler');
const { ok, created } = require('./apiResponse');
const ApiError = require('./ApiError');

/**
 * Wraps a crudFactory repository into standard list/get/create/update/delete
 * handlers. Pass `transformInput` to sanitize/shape the body before writes,
 * and `notFoundMessage` for a friendlier 404.
 */
function makeCrudController(repo, { transformInput, notFoundMessage = 'Not found', serialize } = {}) {
  const s = serialize || ((x) => x);
  const list = asyncHandler(async (req, res) => {
    const { page, pageSize, search, ...filters } = req.query;
    const result = await repo.list({ page, pageSize, search, filters });
    ok(res, { ...result, rows: result.rows.map(s) });
  });

  const getOne = asyncHandler(async (req, res) => {
    const item = await repo.findById(req.params.id);
    if (!item) throw ApiError.notFound(notFoundMessage);
    ok(res, s(item));
  });

  const createOne = asyncHandler(async (req, res) => {
    const data = transformInput ? await transformInput(req.body, { req }) : req.body;
    const item = await repo.create(data);
    created(res, s(item));
  });

  const updateOne = asyncHandler(async (req, res) => {
    const existing = await repo.findById(req.params.id);
    if (!existing) throw ApiError.notFound(notFoundMessage);
    const data = transformInput ? await transformInput(req.body, { req, existing, isUpdate: true }) : req.body;
    const item = await repo.update(req.params.id, data);
    ok(res, s(item), 'Updated');
  });

  const deleteOne = asyncHandler(async (req, res) => {
    const existing = await repo.findById(req.params.id);
    if (!existing) throw ApiError.notFound(notFoundMessage);
    await repo.remove(req.params.id);
    ok(res, null, 'Deleted');
  });

  return { list, getOne, createOne, updateOne, deleteOne };
}

module.exports = { makeCrudController };
