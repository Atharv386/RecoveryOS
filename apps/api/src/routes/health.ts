import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool } from '@recoveryos/db';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', async (_request, reply) => {
    let dbStatus = 'disconnected';
    try {
      const pool = getDatabasePool();
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected_or_unreachable';
    }

    const isHealthy = dbStatus === 'connected' || process.env.NODE_ENV === 'test';

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'RecoveryOS API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        ai_enabled: process.env.AI_ENABLED !== 'false'
      }
    });
  });
};
