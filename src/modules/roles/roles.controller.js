const repo = require('./roles.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const crud = makeCrudController(repo, { notFoundMessage: 'Role not found' });

const listPermissions = asyncHandler(async (req, res) => {
  ok(res, await repo.listPermissions());
});

const getRolePermissions = asyncHandler(async (req, res) => {
  const role = await repo.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  ok(res, await repo.getPermissionIdsForRole(req.params.id));
});

const setRolePermissions = asyncHandler(async (req, res) => {
  const role = await repo.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  const ids = Array.isArray(req.body.permissionIds) ? req.body.permissionIds : [];
  await repo.setPermissionsForRole(req.params.id, ids);
  ok(res, await repo.getPermissionIdsForRole(req.params.id), 'Permissions updated');
});

module.exports = { ...crud, listPermissions, getRolePermissions, setRolePermissions };
