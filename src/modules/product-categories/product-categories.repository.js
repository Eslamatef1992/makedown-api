const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'product_categories',
  searchableColumns: ['name_en', 'name_ar', 'slug'],
  defaultOrderBy: 'sort_order ASC, name_en ASC',
});
