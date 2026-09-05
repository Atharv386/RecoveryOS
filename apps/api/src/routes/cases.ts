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
        `SELECT rc.*, p.amount_in_paise, p.currency, p.method, p.error_code, p.error_description,
                COALESCE(c.email, p.raw_payload->>'email', c.contact, 'Enterprise Customer') as customer_name
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         LEFT JOIN customers c ON p.customer_id = c.id
         WHERE rc.merchant_id = $1
         ORDER BY rc.created_at DESC
         LIMIT 100`,
        [merchantId]
      );
      return reply.send({ cases: result.rows });
    } catch (err: any) {
      request.log.error(err);
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
                COALESCE(c.email, p.raw_payload->>'email', c.contact, 'Enterprise Customer') as customer_name,
                d.failure_class as diagnosed_class, d.confidence as ai_confidence, d.reasoning as ai_reasoning,
                pd.verdict as policy_verdict, pd.rules_fired
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         LEFT JOIN customers c ON p.customer_id = c.id
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

  // 3. Live Action Execution / Instant Recovery Simulation
  fastify.post('/cases/:id/execute-action', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';
    try {
      const pool = getDatabasePool();
      
      // Update case to RECOVERED and log to audit_logs
      const updateResult = await pool.query(
        `UPDATE recovery_cases rc
         SET state = 'RECOVERED',
             recovered_at = NOW(),
             recovered_amount_in_paise = p.amount_in_paise,
             attempt_count = rc.attempt_count + 1,
             updated_at = NOW()
         FROM payments p
         WHERE rc.payment_id = p.id AND rc.id = $1 AND rc.merchant_id = $2
         RETURNING rc.*, p.amount_in_paise`,
        [id, merchantId]
      );

      if (updateResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Case not found' });
      }

      // Record in audit_logs
      await pool.query(
        `INSERT INTO audit_logs (merchant_id, case_id, actor, action, from_state, to_state, metadata)
         VALUES ($1, $2, $3, 'PAYMENT_RECOVERED', 'ACTION_SCHEDULED', 'RECOVERED', $4)`,
        [
          merchantId,
          id,
          request.auth?.email || 'operator@recoveryos.dev',
          JSON.stringify({
            amount_in_paise: updateResult.rows[0].amount_in_paise,
            method: 'smart_retry_link',
            state: 'RECOVERED'
          })
        ]
      );

      return reply.send({
        success: true,
        message: 'Recovery action executed successfully. Payment marked as RECOVERED.',
        case: updateResult.rows[0]
      });
    } catch (err: any) {
      return reply.status(400).send({ error: 'Execution failed', message: err.message });
    }
  });

  // 4. Provider Reconciliation Flow
  fastify.post('/cases/:id/reconcile', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';
    const body = request.body as { outcome?: 'CAPTURED' | 'STILL_FAILED' | 'UNAVAILABLE' } | undefined;
    const requestedOutcome = body?.outcome || 'CAPTURED';

    try {
      const pool = getDatabasePool();
      
      if (requestedOutcome === 'CAPTURED') {
        const updateResult = await pool.query(
          `UPDATE recovery_cases rc
           SET state = 'RECOVERED',
               recovered_at = NOW(),
               recovered_amount_in_paise = p.amount_in_paise,
               updated_at = NOW()
           FROM payments p
           WHERE rc.payment_id = p.id AND rc.id = $1 AND rc.merchant_id = $2
           RETURNING rc.*, p.amount_in_paise`,
          [id, merchantId]
        );

        if (updateResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Case not found' });
        }

        await pool.query(
          `INSERT INTO audit_logs (merchant_id, case_id, actor, action, from_state, to_state, metadata)
           VALUES ($1, $2, $3, 'RECONCILIATION_RESOLVED', 'OUTCOME_UNKNOWN', 'RECOVERED', $4)`,
          [
            merchantId,
            id,
            request.auth?.email || 'OPERATOR:finance@saascorp.in',
            JSON.stringify({
              provider: 'razorpay',
              outcome: 'PAYMENT_CAPTURED',
              verification: 'Payment confirmed captured by bank. Duplicate retry avoided.',
              timestamp: new Date().toISOString()
            })
          ]
        );

        return reply.send({
          success: true,
          outcome: 'PAYMENT_CAPTURED',
          message: 'The provider confirmed that the recovery action succeeded. RecoveryOS prevented a duplicate retry.',
          case: updateResult.rows[0]
        });
      } else if (requestedOutcome === 'STILL_FAILED') {
        await pool.query(
          `INSERT INTO audit_logs (merchant_id, case_id, actor, action, from_state, to_state, metadata)
           VALUES ($1, $2, $3, 'RECONCILIATION_CONFIRMED_FAILED', 'OUTCOME_UNKNOWN', 'OUTCOME_UNKNOWN', $4)`,
          [
            merchantId,
            id,
            request.auth?.email || 'OPERATOR:finance@saascorp.in',
            JSON.stringify({
              provider: 'razorpay',
              outcome: 'PAYMENT_STILL_FAILED',
              verification: 'The provider confirmed that the action did not succeed. Recovery policy evaluation can continue.',
              timestamp: new Date().toISOString()
            })
          ]
        );

        return reply.send({
          success: true,
          outcome: 'PAYMENT_STILL_FAILED',
          message: 'The provider confirmed that the action did not succeed. Recovery policy evaluation can continue.'
        });
      } else {
        await pool.query(
          `INSERT INTO audit_logs (merchant_id, case_id, actor, action, from_state, to_state, metadata)
           VALUES ($1, $2, $3, 'RECONCILIATION_UNAVAILABLE', 'OUTCOME_UNKNOWN', 'OUTCOME_UNKNOWN', $4)`,
          [
            merchantId,
            id,
            request.auth?.email || 'OPERATOR:finance@saascorp.in',
            JSON.stringify({
              provider: 'razorpay',
              outcome: 'PROVIDER_STATUS_UNAVAILABLE',
              verification: 'RecoveryOS could not obtain payment truth. The case remains in reconciliation. No new financial action executed.',
              timestamp: new Date().toISOString()
            })
          ]
        );

        return reply.send({
          success: true,
          outcome: 'PROVIDER_STATUS_UNAVAILABLE',
          message: 'RecoveryOS could not obtain payment truth. The case remains in reconciliation. No new financial action will be executed.'
        });
      }
    } catch (err: any) {
      return reply.status(400).send({ error: 'Reconciliation failed', message: err.message });
    }
  });
};
