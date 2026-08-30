const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'product_categories',
  searchableColumns: ['name', 'slug'],
  defaultOrderBy: 'sort_order ASC, name ASC',
});
