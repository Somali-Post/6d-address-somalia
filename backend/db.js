const { Pool, types } = require('pg');

// --- FIX: Tell node-postgres to NOT parse timestamps ---
// This ensures that TIMESTAMPTZ columns are returned as ISO 8601 strings,
// which is the most reliable format for JSON.
// The OID for TIMESTAMPTZ is 1184.
types.setTypeParser(1184, (stringValue) => {
  return stringValue; // Return the raw string
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};