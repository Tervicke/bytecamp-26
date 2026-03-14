import { db } from '../lib/SQLite/db.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function loginUser(username: string, passwordPlain: string): Promise<{ token: string, user: any } | null> {
    const query = db.query('SELECT * FROM users WHERE username = $username');
    const user = query.get({ $username: username }) as any;

    if (!user) {
        return null; // User not found
    }

    // Verify password
    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isValid) {
        return null; // Invalid password
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );

    const { password_hash, ...safeUser } = user;

    return { token, user: safeUser };
}
