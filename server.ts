import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ scores: [] }));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // API Routes
  app.get('/api/leaderboard', (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      // Sort by score (level * 1000 + xp) descending
      const sorted = data.scores.sort((a: any, b: any) => b.score - a.score).slice(0, 25);
      res.json(sorted);
    } catch (e) {
      res.status(500).json({ error: 'Failed to read leaderboard' });
    }
  });

  app.post('/api/score', (req, res) => {
    try {
      const { name, score, level } = req.body;
      if (!name || score === undefined) {
        return res.status(400).json({ error: 'Missing name or score' });
      }

      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      
      // Check if user exists and update if score is higher
      const existingIndex = data.scores.findIndex((s: any) => s.name === name);
      
      if (existingIndex >= 0) {
        if (score > data.scores[existingIndex].score) {
          data.scores[existingIndex] = { name, score, level, date: new Date().toISOString() };
        }
      } else {
        data.scores.push({ name, score, level, date: new Date().toISOString() });
      }

      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save score' });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
