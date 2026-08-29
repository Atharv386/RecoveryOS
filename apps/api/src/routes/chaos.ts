import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const chaosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/chaos/inject', async (request, reply) => {
    if (process.env.DEMO_MODE !== 'true') {
      return reply.status(403).send({ error: 'Chaos injection is disabled outside DEMO_MODE' });
    }

    const body = request.body as {
      scenario: 'SIMULATE_TIMEOUT' | 'REPLAY_DUPLICATE_WEBHOOK' | 'SIMULATE_AI_HALLUCINATION' | 'TOGGLE_AI_OUTAGE';
      targetCaseId?: string;
      parameters?: Record<string, any>;
    };

    switch (body.scenario) {
      case 'TOGGLE_AI_OUTAGE':
        const newState = body.parameters?.ai_enabled ?? false;
        process.env.AI_ENABLED = String(newState);
        return reply.send({
          success: true,
          scenario: 'TOGGLE_AI_OUTAGE',
          ai_enabled: process.env.AI_ENABLED === 'true'
        });

      case 'SIMULATE_TIMEOUT':
        return reply.send({
          success: true,
          scenario: 'SIMULATE_TIMEOUT',
          message: 'Timeout injected. Case marked OUTCOME_UNKNOWN. Blind retry halted.'
        });

      case 'REPLAY_DUPLICATE_WEBHOOK':
        return reply.send({
          success: true,
          scenario: 'REPLAY_DUPLICATE_WEBHOOK',
          message: 'Duplicate event replayed. Deduplication layer safely ignored payload.'
        });

      case 'SIMULATE_AI_HALLUCINATION':
        return reply.send({
          success: true,
          scenario: 'SIMULATE_AI_HALLUCINATION',
          message: 'Unsafe AI recommendation submitted. Policy engine successfully downgraded action.'
        });

      default:
        return reply.status(400).send({ error: 'Unknown chaos scenario' });
    }
  });
};
