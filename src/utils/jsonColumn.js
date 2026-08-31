// mysql2 auto-deserializes native MySQL `JSON` columns into real JS
// values (arrays/objects) when they're SELECTed — it does NOT return them
// as JSON-encoded strings. Some call sites still do `JSON.parse(value)` on
// those columns as if they were strings, which throws once the column
// actually holds data (JSON.parse coerces a non-string via `.toString()`
// first, e.g. an array becomes a comma-joined string, which then fails to
// parse). Use this helper anywhere a JSON-typed column's value needs to be
// read as a JS value, so it works whether the driver handed back a string
// or an already-parsed value.
function parseJsonColumn(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

module.exports = { parseJsonColumn };
