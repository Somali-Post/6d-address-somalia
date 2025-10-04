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
