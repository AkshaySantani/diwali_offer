import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb, initSchemaAndSeed } from './server/db.js';
import { customerRouter } from './server/routes/customerRoutes.js';
import { spinRouter } from './server/routes/spinRoutes.js';
import { cashierRouter } from './server/routes/cashierRoutes.js';
import { adminRouter } from './server/routes/adminRoutes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Neon PostgreSQL Database & verify single table diwali_spins
  try {
    await initSchemaAndSeed();
    console.log('[Server] Neon PostgreSQL database initialized successfully.');
  } catch (err) {
    console.error('[Server] Failed to initialize Neon database:', err);
  }

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', campaign: 'Akshay Footwear Diwali 2026' });
  });

  // API Routes
  app.use('/api/customer', customerRouter);
  app.use('/api/spin', spinRouter);
  app.use('/api/redemption', cashierRouter);
  app.use('/api/auth', cashierRouter);
  app.use('/api/admin', adminRouter);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Akshay Footwear server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
