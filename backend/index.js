require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https'); // ADD THIS
const fs = require('fs');       // ADD THIS

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({ origin: ['https://6d-address-somalia.netlify.app', 'http://127.0.0.1:5500'] }));
app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- HTTPS Server Setup ---
const httpsOptions = {
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem')
};

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Server is running securely on https://localhost:${PORT}`);
});