// The very first thing we do is load environment variables.
require('dotenv').config();

// --- Production-Safe Date Patch ---
// This patch is only for our specific local development issue.
// We will not run this in production to avoid unforeseen side effects.
if (process.env.NODE_ENV !== 'production') {
  if (Date.prototype.toJSON.toString() !== 'function toJSON() { [native code] }') {
    const originalToJSON = Date.prototype.toISOString;
    Date.prototype.toJSON = function() {
      return originalToJSON.call(this);
    };
    console.log("✅ (Dev Only) Patched Date.prototype.toJSON.");
  }
  // The json-bigint require is also a dev-only fix.
  require('json-bigint')({ useNativeBigInt: true });
}
// --- End of Patch ---

const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Always listen on all interfaces in production

// --- Middleware ---
const allowedOrigins = [
  'https://6d-address-somalia.netlify.app',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- Server ---
app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
});