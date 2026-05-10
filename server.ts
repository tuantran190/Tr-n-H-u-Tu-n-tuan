import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { aiRouter } from './src/server/api/ai';
import { tradingRouter } from './src/server/api/trading';
import { backtestRouter } from './src/server/api/backtest';
import { authRouter } from './src/server/api/auth';
import { chatRouter } from './src/server/api/chat';
import { setupWsServer } from './src/server/ws';
import { startBotEngine } from './src/server/engine/bot';
import { connectDB } from './src/server/db/mongo';

async function startServer() {
  await connectDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/trading', tradingRouter);
  app.use('/api/backtest', backtestRouter);
  app.use('/api/chat', chatRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
  });

  // Vite middlewware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  setupWsServer(server);
  startBotEngine();
}

startServer().catch(console.error);
