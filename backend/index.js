require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usersRouter = require('./routes/users');
// We will create this auth router in the next step
const authRouter = require('./routes/auth'); 

const app = express();
const PORT = process.env.PORT || 3001;

// Diagnostic middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Incoming Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// --- Middleware ---
// Enable CORS for our Netlify frontend
// Enable CORS for our Netlify frontend AND our local development server
app.use(cors({
  origin: [
    'https://6d-address-somalia.netlify.app', // For production
    'http://127.0.0.1:5500'                  // For local development with Live Server
  ]
}));
app.use(express.json()); // To parse JSON request bodies

// --- Routes ---
app.use('/api/auth', authRouter); // We will uncomment this later
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
