const { Pool, types } = require('pg');

// --- DEFINITIVE FIX: Tell node-postgres to NOT parse timestamps ---
// This ensures that TIMESTAMPTZ columns (OID 1184) are always returned
// as standard ISO 8601 strings, which is the most reliable format for JSON.
types.setTypeParser(1184, (stringValue) => {
  return stringValue; // Return the raw string from the database
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};