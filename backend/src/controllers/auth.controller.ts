import type { Request, Response } from 'express';
import { loginUser } from '../services/auth.service.ts';

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const result = await loginUser(username, password);

        if (!result) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        res.json({
            message: 'Login successful',
            token: result.token,
            user: result.user
        });
    } catch (error) {
        console.error('[Auth Controller] Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/auth/logout
 * Since we use JWT Bearer tokens, the actual token clearing happens on the client,
 */
export async function logout(req: Request, res: Response): Promise<void> {
    try {
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('[Auth Controller] Error during logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
