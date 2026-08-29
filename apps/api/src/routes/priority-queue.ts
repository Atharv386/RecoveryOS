import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool } from '@recoveryos/db';
import { requireAuth } from '../middleware/auth.middleware.js';

export const priorityQueueRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * Section 10 of Blueprint: High-Value Recovery Queue
   * Calculates Recovery Score & Expected Recovery Value (Amount * Probability)
   * Ranks cases so merchant operations can prioritize high-impact interventions.
   */
  fastify.get('/cases/priority-queue', { preHandler: requireAuth }, async (request, reply) => {
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';

    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT 
           rc.id AS case_id,
           rc.state,
           rc.failure_class,
           rc.attempt_count,
           rc.max_attempts,
           rc.created_at,
           p.razorpay_payment_id,
           p.amount_in_paise,
           p.currency,
           p.method,
           p.error_code,
           p.error_description,
           COALESCE(d.confidence, 0.50)::numeric(4, 3) AS recovery_probability,
           ROUND((p.amount_in_paise * COALESCE(d.confidence, 0.50)) / 100, 2)::numeric(12, 2) AS expected_recovery_rupees,
           ROUND(p.amount_in_paise / 100.0, 2)::numeric(12, 2) AS amount_rupees,
           d.recommended_action,
           d.reasoning,
           pd.verdict AS policy_verdict
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         LEFT JOIN diagnoses d ON d.case_id = rc.id
         LEFT JOIN policy_decisions pd ON pd.case_id = rc.id
         WHERE rc.merchant_id = $1 AND rc.state NOT IN ('RECOVERED', 'EXHAUSTED')
         ORDER BY expected_recovery_rupees DESC
         LIMIT 50`,
        [merchantId]
      );

      // Aggregate summary bands
      let totalExpectedRupees = 0;
      let totalAtRiskRupees = 0;

      for (const row of result.rows) {
        totalExpectedRupees += Number(row.expected_recovery_rupees);
        totalAtRiskRupees += Number(row.amount_rupees);
      }

      return reply.send({
        success: true,
        summary: {
          activeCasesCount: result.rows.length,
          totalAtRiskRupees: Number(totalAtRiskRupees.toFixed(2)),
          totalExpectedRecoveryRupees: Number(totalExpectedRupees.toFixed(2)),
          overallExpectedYieldPercent: totalAtRiskRupees > 0 ? Number(((totalExpectedRupees / totalAtRiskRupees) * 100).toFixed(2)) : 0
        },
        priorityQueue: result.rows
      });
    } catch {
      return reply.send({
        success: true,
        summary: { activeCasesCount: 0, totalAtRiskRupees: 0, totalExpectedRecoveryRupees: 0, overallExpectedYieldPercent: 0 },
        priorityQueue: []
      });
    }
  });
};
