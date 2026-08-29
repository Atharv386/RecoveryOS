import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { getDatabasePool } from '@recoveryos/db';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

async function start() {
  const app = await buildApp();

  try {
    // Attempt DB migration check if configured
    try {
      const pool = getDatabasePool();
      await pool.query('SELECT 1');
      console.log('✓ PostgreSQL connected successfully.');
    } catch {
      console.warn('⚠️ PostgreSQL connection failed or not started yet. Running in offline/memory mode.');
    }

    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 RecoveryOS API Service running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
