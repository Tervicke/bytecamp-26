import express from 'express';
import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transactions.routes.js';
import entitiesRoutes from './routes/entities.routes.js';
import flagsRoutes, { dashboardRouter, analysisRouter } from './routes/flags.routes.js';
import graphRoutes from './routes/graph.routes.js';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

// Simple CORS for dev — allow all origins (tighten in production)
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',         authRoutes);
app.use('/api/flags',        flagsRoutes);
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/analysis',     analysisRouter);
app.use('/api/entities',     entitiesRoutes);
app.use('/api/graph',        graphRoutes);
app.use('/api/transactions', transactionRoutes);

export default app;
