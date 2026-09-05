import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool } from '@recoveryos/db';
import { requireAuth } from '../middleware/auth.middleware.js';

export const auditRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/audit-logs', { preHandler: requireAuth }, async (request, reply) => {
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT al.id, al.merchant_id, al.case_id, al.actor, al.action, al.from_state, al.to_state, al.metadata, al.created_at, rc.state as current_case_state
         FROM audit_logs al
         LEFT JOIN recovery_cases rc ON al.case_id = rc.id
         WHERE al.merchant_id = $1
         ORDER BY al.created_at DESC
         LIMIT 100`,
        [merchantId]
      );
      return reply.send({ audit_logs: result.rows });
    } catch {
      return reply.send({ audit_logs: [] });
    }
  });
};
