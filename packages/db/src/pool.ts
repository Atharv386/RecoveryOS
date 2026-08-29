import pg from 'pg';

let globalPool: pg.Pool | null = null;

export function createDatabasePool(connectionString?: string): pg.Pool {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/recoveryos';
  return new pg.Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
}

export function getDatabasePool(): pg.Pool {
  if (!globalPool) {
    globalPool = createDatabasePool();
  }
  return globalPool;
}

export async function closeDatabasePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}
