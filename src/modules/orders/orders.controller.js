const repo = require('./orders.repository');
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, status, payment_status, guest } = req.query;
  const result = await repo.list({ page, pageSize, filters: { status, payment_status, guest } });
  ok(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await repo.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const items = await repo.listItems(req.params.id);
  ok(res, { ...order, items });
});

const updateStatus = asyncHandler(async (req, res) => {
  const existing = await repo.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Order not found');
  const data = {};
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.paymentStatus !== undefined) data.payment_status = req.body.paymentStatus;
  const order = await repo.updateStatus(req.params.id, data);
  ok(res, order, 'Updated');
});

module.exports = { list, getOne, updateStatus };
