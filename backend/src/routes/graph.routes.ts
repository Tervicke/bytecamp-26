import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getFullGraph } from '../controllers/graph.controller.js';

const router = Router();

router.use(verifyToken);
router.get('/', getFullGraph);

export default router;
