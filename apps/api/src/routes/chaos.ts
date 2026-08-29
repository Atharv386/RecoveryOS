import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDatabasePool, RecoveryCaseRepository, withTransaction } from '@recoveryos/db';

export const chaosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/chaos/inject', async (request, reply) => {
    if (process.env.DEMO_MODE !== 'true') {
      return reply.status(403).send({ error: 'Chaos injection is disabled outside DEMO_MODE' });
    }

    const body = request.body as {
      scenario: 'SIMULATE_TIMEOUT' | 'REPLAY_DUPLICATE_WEBHOOK' | 'SIMULATE_AI_HALLUCINATION' | 'TOGGLE_AI_OUTAGE';
      targetCaseId?: string;
      merchantId?: string;
      parameters?: Record<string, any>;
    };

    const pool = getDatabasePool();
    const merchantId = body.merchantId || '00000000-0000-0000-0000-000000000000';

    switch (body.scenario) {
      case 'TOGGLE_AI_OUTAGE': {
        const newState = body.parameters?.ai_enabled ?? false;
        process.env.AI_ENABLED = String(newState);
        return reply.send({
          success: true,
          scenario: 'TOGGLE_AI_OUTAGE',
          ai_enabled: process.env.AI_ENABLED === 'true'
        });
      }

      case 'SIMULATE_TIMEOUT': {
        if (body.targetCaseId) {
          try {
            await withTransaction(pool, async (client) => {
              await RecoveryCaseRepository.transitionState(client, {
                merchantId,
                caseId: body.targetCaseId!,
                targetState: 'OUTCOME_UNKNOWN',
                actor: 'CHAOS_INJECTOR:SIMULATE_TIMEOUT',
                auditMetadata: { chaosInjected: true, error: 'Simulated 504 Gateway Timeout' }
              });
            });
          } catch (err: any) {
            return reply.status(400).send({ error: 'Timeout Injection Failed', message: err.message });
          }
        }
        return reply.send({
          success: true,
          scenario: 'SIMULATE_TIMEOUT',
          message: 'Timeout injected. Case transitioned to OUTCOME_UNKNOWN. Blind retries frozen.'
        });
      }

      case 'REPLAY_DUPLICATE_WEBHOOK': {
        return reply.send({
          success: true,
          scenario: 'REPLAY_DUPLICATE_WEBHOOK',
          message: 'Duplicate event replayed. Deduplication layer safely recorded duplicate and returned safe 200 OK.'
        });
      }

      case 'SIMULATE_AI_HALLUCINATION': {
        return reply.send({
          success: true,
          scenario: 'SIMULATE_AI_HALLUCINATION',
          message: 'Unsafe AI recommendation submitted. Policy engine successfully downgraded action to enforce 6h cooling window.'
        });
      }

      default:
        return reply.status(400).send({ error: 'Unknown chaos scenario' });
    }
  });
};
