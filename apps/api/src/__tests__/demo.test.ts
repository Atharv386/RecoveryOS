import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { DemoOrchestrator } from '../services/demo-orchestrator.js';

describe('5-Minute Panel Audition Demo Orchestrator', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('DemoOrchestrator should execute Demo A (Duplicate Webhooks) with full assertion proofs', async () => {
    const result = await DemoOrchestrator.runScenario('DEMO_A');
    expect(result.scenarioId).toBe('DEMO_A');
    expect(result.success).toBe(true);
    expect(result.keyAssertions.every(a => a.passed)).toBe(true);
  });

  it('DemoOrchestrator should execute Demo B (Timeout & Reconciliation) with double-charge freeze proof', async () => {
    const result = await DemoOrchestrator.runScenario('DEMO_B');
    expect(result.scenarioId).toBe('DEMO_B');
    expect(result.success).toBe(true);
    expect(result.keyAssertions.find(a => a.assertion.includes('Double debit'))?.passed).toBe(true);
  });

  it('DemoOrchestrator should execute Demo C (AI Policy Override) with cooling window downgrade', async () => {
    const result = await DemoOrchestrator.runScenario('DEMO_C');
    expect(result.scenarioId).toBe('DEMO_C');
    expect(result.success).toBe(true);
    expect(result.keyAssertions.find(a => a.assertion.includes('cooling window'))?.passed).toBe(true);
  });

  it('DemoOrchestrator should execute Demo D (AI Outage Fallback) with zero downtime', async () => {
    const result = await DemoOrchestrator.runScenario('DEMO_D');
    expect(result.scenarioId).toBe('DEMO_D');
    expect(result.success).toBe(true);
    expect(result.keyAssertions.find(a => a.assertion.includes('disabled'))?.passed).toBe(true);
  });

  it('GET /api/v1/demo/scenarios should list all 4 audition scenarios', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/demo/scenarios'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.scenarios.length).toBe(4);
  });

  it('POST /api/v1/demo/run-scenario should execute demo scenario and return timeline', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/run-scenario',
      headers: { 'content-type': 'application/json' },
      payload: { scenarioId: 'DEMO_B' }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.scenario.timeline.length).toBeGreaterThanOrEqual(3);
  });
});
