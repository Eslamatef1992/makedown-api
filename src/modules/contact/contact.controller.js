const repo = require('./contact.repository');
const { makeCrudController } = require('../../utils/crudController');
const asyncHandler = require('../../utils/asyncHandler');
const { created } = require('../../utils/apiResponse');

function transformInput(body) {
  const data = {};
  if (body.status !== undefined) data.status = body.status;
  return data;
}

const crud = makeCrudController(repo, { transformInput, notFoundMessage: 'Message not found' });

// Public — "contact us" form on the website submits here.
const submit = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const item = await repo.create({ name, email, phone: phone || null, subject: subject || null, message });
  created(res, { id: item.id }, 'Message sent');
});

module.exports = { list: crud.list, getOne: crud.getOne, updateOne: crud.updateOne, submit };
