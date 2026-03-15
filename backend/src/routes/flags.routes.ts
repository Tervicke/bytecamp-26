import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getFlags,
  overrideFlagLevel,
  getDashboardStats,
  getVolumeChart,
  runAnalysis,
  searchEntities,
} from '../controllers/flags.controller.js';

// ─── /api/flags ───────────────────────────────────────────────────────────────
const flagsRouter = Router();
flagsRouter.use(verifyToken);
flagsRouter.get('/', getFlags);
flagsRouter.get('/search', searchEntities);
flagsRouter.post('/override', overrideFlagLevel);

// ─── /api/dashboard ───────────────────────────────────────────────────────────
const dashboardRouter = Router();
dashboardRouter.use(verifyToken);
dashboardRouter.get('/stats', getDashboardStats);
dashboardRouter.get('/volume', getVolumeChart);

// ─── /api/analysis ────────────────────────────────────────────────────────────
const analysisRouter = Router();
analysisRouter.use(verifyToken);
analysisRouter.post('/run', runAnalysis);

export default flagsRouter;
export { dashboardRouter, analysisRouter };
