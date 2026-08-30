const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'admins',
  searchableColumns: ['name', 'email'],
});
