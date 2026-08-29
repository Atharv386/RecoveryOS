import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DemoOrchestrator } from '../services/demo-orchestrator.js';

export const demoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/demo/scenarios', async (_request, reply) => {
    return reply.send({
      scenarios: [
        {
          id: 'DEMO_A',
          title: 'Demo A: Duplicate & Out-of-Order Webhooks',
          description: 'Replayed webhooks ignored via dedup; terminal state RECOVERED never regresses.'
        },
        {
          id: 'DEMO_B',
          title: 'Demo B: Ambiguous Timeout & Reconciliation',
          description: 'Network timeout triggers OUTCOME_UNKNOWN, freezes blind retries, reconciler verifies gateway ground truth.'
        },
        {
          id: 'DEMO_C',
          title: 'Demo C: AI Misdiagnosis & Policy Downgrade',
          description: 'Unsafe immediate retry recommendation downgraded by policy to enforce 6-hour cooling window.'
        },
        {
          id: 'DEMO_D',
          title: 'Demo D: AI Outage & Deterministic Fallback',
          description: 'AI_ENABLED=false switches instantly to deterministic error code mapping with zero downtime.'
        }
      ]
    });
  });

  fastify.post('/demo/run-scenario', async (request, reply) => {
    const body = request.body as {
      scenarioId: 'DEMO_A' | 'DEMO_B' | 'DEMO_C' | 'DEMO_D';
    };

    if (!body?.scenarioId) {
      return reply.status(400).send({
        error: 'Missing scenarioId',
        message: "Must provide scenarioId: 'DEMO_A' | 'DEMO_B' | 'DEMO_C' | 'DEMO_D'"
      });
    }

    try {
      const result = await DemoOrchestrator.runScenario(body.scenarioId);
      return reply.send({
        success: true,
        scenario: result
      });
    } catch (err) {
      return reply.status(400).send({
        error: 'Scenario Execution Failed',
        message: (err as Error).message
      });
    }
  });
};
