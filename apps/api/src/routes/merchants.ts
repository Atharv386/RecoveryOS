import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool } from '@recoveryos/db';
import { requireAuth } from '../middleware/auth.middleware.js';

export const merchantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. List all merchants
  fastify.get('/merchants', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT m.id, m.name, m.razorpay_account_id, m.policy_config, m.created_at,
                COUNT(rc.id) as total_cases,
                COUNT(CASE WHEN rc.state = 'RECOVERED' THEN 1 END) as recovered_cases,
                COALESCE(SUM(CASE WHEN rc.state = 'RECOVERED' THEN p.amount_in_paise ELSE 0 END), 0) as recovered_revenue_paise
         FROM merchants m
         LEFT JOIN recovery_cases rc ON m.id = rc.merchant_id
         LEFT JOIN payments p ON rc.payment_id = p.id
         GROUP BY m.id
         ORDER BY m.created_at ASC`
      );
      return reply.send({ merchants: result.rows });
    } catch {
      return reply.send({ merchants: [] });
    }
  });

  // 2. Update merchant policy configuration
  fastify.put('/merchants/:id/policy', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { policy: any };
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `UPDATE merchants
         SET policy_config = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, policy_config`,
        [JSON.stringify(body.policy), id]
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Merchant not found' });
      }
      return reply.send({ success: true, merchant: result.rows[0] });
    } catch (err: any) {
      return reply.status(400).send({ error: 'Failed to update policy', message: err.message });
    }
  });
};
