import 'dotenv/config';
import app from './app.ts';
import { connectNeo4j } from './lib/neo4j/neo4j.ts';
import { db } from './lib/SQLite/db.ts';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 3000;

async function seedAdminUser() {
  // Check if any users exist
  const query = db.query('SELECT COUNT(*) as count FROM users');
  const result = query.get() as { count: number };

  if (result.count === 0) {
    console.log('[Auth] No users found. Seeding default admin user...');

    const username = 'admin';
    const passwordPlain = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const insert = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES ($id, $username, $passwordHash, $role)');
    insert.run({
      $id: crypto.randomUUID(),
      $username: username,
      $passwordHash: passwordHash,
      $role: 'admin'
    });

    console.log(`[Auth] Default admin seeded. (Username: ${username}, Password: ${passwordPlain})`);
  } else {
    console.log(`[Auth] Users exist (${result.count}). Skipping admin seed.`);
  }
}

async function startServer() {
  try {
    await connectNeo4j();
    await seedAdminUser();

    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

startServer();
