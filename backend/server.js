import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Railway dynamically assigns PORT
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Hello from Node.js Backend on Railway!',
    status: 'Connected',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toLocaleTimeString(),
  });
});

// Serve frontend static build in production
const distPath = path.join(__dirname, '../frontend/dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // Fallback to React index.html for SPA
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Backend API is active at /api/test (Frontend build not found)');
  });
}

// Start server - bind to 0.0.0.0 for Railway container support
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
