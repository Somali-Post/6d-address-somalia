const { Pool, types } = require('pg');

// This is the definitive fix.
// It tells node-postgres to return TIMESTAMPTZ columns as raw strings.
types.setTypeParser(1184, (stringValue) => {
  return stringValue; 
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};