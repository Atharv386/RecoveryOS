import pg from 'pg';

export type Queryable = pg.Pool | pg.PoolClient;

/**
 * Executes a callback function inside an ACID PostgreSQL transaction.
 * Automatically issues BEGIN, COMMIT, or ROLLBACK upon errors.
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if connection was dropped
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Locks a specific row using SELECT ... FOR UPDATE to prevent concurrency race conditions.
 */
export async function selectForUpdate<T>(
  client: pg.PoolClient,
  table: string,
  id: string,
  merchantId: string
): Promise<T | null> {
  const result = await client.query(
    `SELECT * FROM ${table} 
     WHERE id = $1 AND merchant_id = $2 
     FOR UPDATE`,
    [id, merchantId]
  );
  return (result.rows[0] as T) || null;
}
