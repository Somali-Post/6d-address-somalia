// The root cause of the JSON parsing error is the 'json-bigint' library,
// which is a dependency of 'gcp-metadata' (which is used by 'google-auth-library').
// By default, 'json-bigint' modifies the global Date.prototype.toJSON,
// which corrupts the JSON output of Express's res.json().
//
// The fix is to load the "native" version of 'json-bigint' *before* any other
// modules. This version uses the native BigInt object and does not modify
// any prototypes.
if (Date.prototype.toJSON.toString() !== 'function toJSON() { [native code] }') {
  const originalToJSON = Date.prototype.toISOString;
  Date.prototype.toJSON = function() {
    return originalToJSON.call(this);
  };
  console.log("✅ Patched Date.prototype.toJSON to prevent JSON corruption.");
}

require('json-bigint')({ useNativeBigInt: true });

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// --- Middleware ---
// We can be more permissive with CORS for now during ngrok testing
app.use(cors()); 
app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- SIMPLE HTTP SERVER ---
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
