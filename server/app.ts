import express, { Express } from 'express';
import { initSchemaAndSeed } from './db.js';
import { customerRouter } from './routes/customerRoutes.js';
import { spinRouter } from './routes/spinRoutes.js';
import { cashierRouter } from './routes/cashierRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

export function createApp(): Express {
  const app = express();

  // CORS middleware for API requests
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Netlify Functions path normalizer middleware
  // Ensures requests routed from /.netlify/functions/api/* or /api/* map accurately to /api/* routes
  app.use((req, _res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      req.url = req.url.replace(/^\/\.netlify\/functions\/api/, '');
    }
    if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.startsWith('/?')) {
      const knownPrefixes = ['/customer', '/spin', '/redemption', '/auth', '/admin', '/health'];
      if (knownPrefixes.some((p) => req.url.startsWith(p))) {
        req.url = '/api' + req.url;
      }
    }
    next();
  });

  // Lazy idempotent Neon schema verification
  app.use(async (_req, _res, next) => {
    try {
      await initSchemaAndSeed();
    } catch (err) {
      console.error('[Server] Database initialization warning:', err);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      campaign: 'Akshay Footwear Diwali 2026',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API Routers
  app.use('/api/customer', customerRouter);
  app.use('/api/spin', spinRouter);
  app.use('/api/redemption', cashierRouter);
  app.use('/api/auth', cashierRouter);
  app.use('/api/admin', adminRouter);

  return app;
}

export const app = createApp();
