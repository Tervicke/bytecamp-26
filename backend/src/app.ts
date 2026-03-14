import express from 'express';
import authRoutes from './routes/auth.routes.ts';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Export the configured express app
export default app;
