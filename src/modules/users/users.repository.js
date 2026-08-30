const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'users',
  searchableColumns: ['full_name', 'email', 'phone'],
});
