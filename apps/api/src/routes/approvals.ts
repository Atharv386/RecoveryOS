import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  getDatabasePool,
  RecoveryCaseRepository,
  withTransaction
} from '@recoveryos/db';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { QueueManager } from '../queues/queue-manager.js';

export const approvalRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. List pending approvals
  fastify.get('/approvals/pending', { preHandler: requireAuth }, async (request, reply) => {
    const merchantId = request.auth?.merchantId || '00000000-0000-0000-0000-000000000000';

    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT rc.*, p.amount_in_paise, p.currency, p.method, p.error_code, p.error_description,
                d.failure_class, d.confidence, d.reasoning, pd.verdict, pd.rules_fired
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         LEFT JOIN diagnoses d ON d.case_id = rc.id
         LEFT JOIN policy_decisions pd ON pd.case_id = rc.id
         WHERE rc.merchant_id = $1 AND rc.state = 'AWAITING_APPROVAL'
         ORDER BY rc.created_at DESC`,
        [merchantId]
      );

      return reply.send({
        pendingApprovals: result.rows
      });
    } catch {
      return reply.send({ pendingApprovals: [] });
    }
  });

  // 2. Operator Approves Action
  fastify.post(
    '/cases/:id/approve',
    { preHandler: requireRole(['ADMIN', 'OPERATOR']) },
    async (request, reply) => {
      const { id: caseId } = request.params as { id: string };
      const merchantId = request.auth!.merchantId;
      const userActor = `OPERATOR:${request.auth!.email}`;

      const body = request.body as { notes?: string };

      try {
        const pool = getDatabasePool();
        const updatedCase = await withTransaction(pool, async (client) => {
          const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
          if (!currentCase) {
            throw new Error(`Case [${caseId}] not found`);
          }

          if (currentCase.state !== 'AWAITING_APPROVAL') {
            throw new Error(`Cannot approve case in state '${currentCase.state}'. Must be 'AWAITING_APPROVAL'.`);
          }

          // Transition state AWAITING_APPROVAL -> ACTION_SCHEDULED
          const res = await RecoveryCaseRepository.transitionState(client, {
            merchantId,
            caseId,
            targetState: 'ACTION_SCHEDULED',
            actor: userActor,
            nextActionAt: new Date(),
            auditMetadata: {
              approvedBy: request.auth!.email,
              role: request.auth!.role,
              notes: body?.notes || 'Approved by operator'
            }
          });

          // Insert approval record
          await client.query(
            `INSERT INTO approvals (case_id, user_id, action_type, decision, notes)
             VALUES ($1, $2, $3, 'APPROVED', $4)`,
            [caseId, request.auth!.userId, 'MANUAL_APPROVAL', body?.notes || null]
          );

          return res;
        });

        // Enqueue to execution queue
        await QueueManager.enqueueJob(
          'recovery-execution-queue',
          `execute-${caseId}`,
          {
            merchantId,
            caseId,
            policyDecisionId: 'manual_approval',
            actionType: 'PAYMENT_LINK',
            attemptNumber: updatedCase.attempt_count + 1
          },
          { jobId: `exec_manual_${caseId}_${Date.now()}` }
        );

        return reply.send({
          success: true,
          message: `Case [${caseId}] approved successfully and scheduled for recovery.`,
          case: updatedCase
        });
      } catch (err) {
        return reply.status(400).send({
          error: 'Approval Failed',
          message: (err as Error).message
        });
      }
    }
  );

  // 3. Operator Rejects / Escalates Action
  fastify.post(
    '/cases/:id/reject',
    { preHandler: requireRole(['ADMIN', 'OPERATOR']) },
    async (request, reply) => {
      const { id: caseId } = request.params as { id: string };
      const merchantId = request.auth!.merchantId;
      const userActor = `OPERATOR:${request.auth!.email}`;
      const body = request.body as { reason?: string };

      try {
        const pool = getDatabasePool();
        const updatedCase = await withTransaction(pool, async (client) => {
          const currentCase = await RecoveryCaseRepository.findById(client, merchantId, caseId);
          if (!currentCase) {
            throw new Error(`Case [${caseId}] not found`);
          }

          if (currentCase.state !== 'AWAITING_APPROVAL') {
            throw new Error(`Cannot reject case in state '${currentCase.state}'. Must be 'AWAITING_APPROVAL'.`);
          }

          // Transition state AWAITING_APPROVAL -> ESCALATED
          const res = await RecoveryCaseRepository.transitionState(client, {
            merchantId,
            caseId,
            targetState: 'ESCALATED',
            actor: userActor,
            auditMetadata: {
              rejectedBy: request.auth!.email,
              role: request.auth!.role,
              reason: body?.reason || 'Rejected by operator'
            }
          });

          // Insert approval rejection record
          await client.query(
            `INSERT INTO approvals (case_id, user_id, action_type, decision, notes)
             VALUES ($1, $2, $3, 'REJECTED', $4)`,
            [caseId, request.auth!.userId, 'MANUAL_REJECTION', body?.reason || null]
          );

          return res;
        });

        return reply.send({
          success: true,
          message: `Case [${caseId}] rejected and escalated to offline operations.`,
          case: updatedCase
        });
      } catch (err) {
        return reply.status(400).send({
          error: 'Rejection Failed',
          message: (err as Error).message
        });
      }
    }
  );
};
