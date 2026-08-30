const { makeCrudRepository } = require('../../utils/crudFactory');

module.exports = makeCrudRepository({
  table: 'game_categories',
  searchableColumns: ['name', 'slug'],
  defaultOrderBy: 'sort_order ASC, name ASC',
});
