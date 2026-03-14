import { Database } from 'bun:sqlite';
import { join } from 'path';

// Store DB in the backend project root
const dbPath = join(import.meta.dir, '../../../auth.db');
export const db = new Database(dbPath, { create: true });

// Enable WAL mode for better concurrency performance
db.exec('PRAGMA journal_mode = WAL;');

// Initialize the users table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log(`[SQLite] Connected → ${dbPath}`);
