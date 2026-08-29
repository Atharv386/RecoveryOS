import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool } from '@recoveryos/db';
import { requireAuth } from '../middleware/auth.middleware.js';

export const caseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. List cases scoped to authenticated merchant
  fastify.get('/cases', { preHandler: requireAuth }, async (request, reply) => {
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT rc.*, p.amount_in_paise, p.currency, p.method, p.error_code, p.error_description
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         WHERE rc.merchant_id = $1
         ORDER BY rc.created_at DESC
         LIMIT 100`,
        [merchantId]
      );
      return reply.send({ cases: result.rows });
    } catch {
      return reply.send({ cases: [] });
    }
  });

  // 2. Get case by ID scoped to authenticated merchant
  fastify.get('/cases/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';
    try {
      const pool = getDatabasePool();
      const caseResult = await pool.query(
        `SELECT rc.*, p.amount_in_paise, p.currency, p.method, p.error_code, p.error_description,
                d.failure_class as diagnosed_class, d.confidence as ai_confidence, d.reasoning as ai_reasoning,
                pd.verdict as policy_verdict, pd.rules_fired
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         LEFT JOIN diagnoses d ON d.case_id = rc.id
         LEFT JOIN policy_decisions pd ON pd.case_id = rc.id
         WHERE rc.id = $1 AND rc.merchant_id = $2`,
        [id, merchantId]
      );

      if (caseResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Case not found' });
      }

      return reply.send({ case: caseResult.rows[0] });
    } catch {
      return reply.status(404).send({ error: 'Case not found' });
    }
  });
};
