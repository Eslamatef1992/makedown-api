const ApiError = require('./ApiError');

/**
 * Copies a camelCase "<field>En"/"<field>Ar" pair from an incoming request
 * body into the snake_case "<column>_en"/"<column>_ar" DB columns, only
 * when present on the body (so PATCH-style partial updates still work for
 * every other field on the row).
 */
function mapBilingualField(body, data, jsField, dbColumn) {
  const enKey = `${jsField}En`;
  const arKey = `${jsField}Ar`;
  if (body[enKey] !== undefined) data[`${dbColumn}_en`] = body[enKey];
  if (body[arKey] !== undefined) data[`${dbColumn}_ar`] = body[arKey];
}

/**
 * Requires that, for each given DB column base name, both the _en and _ar
 * values end up as non-empty strings in `data`.
 *
 * On create, every listed pair is required outright. On update, a pair is
 * only enforced if the request actually touched it (mapBilingualField put
 * at least one of _en/_ar into `data`) — so an unrelated partial update
 * (e.g. just toggling isActive) doesn't get rejected for not resubmitting
 * text it never meant to change.
 */
function requireBilingual(data, dbColumns, isUpdate = false) {
  for (const column of dbColumns) {
    const enKey = `${column}_en`;
    const arKey = `${column}_ar`;
    const touched = data[enKey] !== undefined || data[arKey] !== undefined;
    if (isUpdate && !touched) continue;

    const en = data[enKey];
    const ar = data[arKey];
    if (en === undefined || ar === undefined || String(en).trim() === '' || String(ar).trim() === '') {
      throw ApiError.badRequest(`Both English and Arabic are required for "${column.replace(/_/g, ' ')}"`);
    }
  }
}

module.exports = { mapBilingualField, requireBilingual };
