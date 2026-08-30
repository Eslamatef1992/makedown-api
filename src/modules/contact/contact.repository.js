const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'contact_messages',
  searchableColumns: ['name', 'email', 'subject'],
});
