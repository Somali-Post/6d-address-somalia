const { Pool, types } = require('pg');

// Force pg to keep TIMESTAMPTZ values as strings so the frontend can format them.
types.setTypeParser(1184, (stringValue) => stringValue);
types.setTypeParser(1114, (stringValue) => stringValue);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Cannot start the database pool.');
}

const poolConfig = { connectionString };

// Render + Supabase require TLS. We relax cert validation because Supabase uses a self-signed cert.
const shouldForceSSL =
  process.env.NODE_ENV === 'production' ||
  /supabase/i.test(connectionString);

if (shouldForceSSL) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

module.exports = {
  query: (text, params) => pool.query(text, params),
};
