const { pool } = require('../../config/db');

async function getValue(key) {
  const [rows] = await pool.query('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', [key]);
  return rows[0]?.setting_value ?? null;
}

async function setValue(key, value) {
  await pool.query(
    `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
  return getValue(key);
}

module.exports = { getValue, setValue };
