import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Benchmark API Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/benchmark/run should execute batch evaluation and return full report', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/benchmark/run',
      headers: { 'content-type': 'application/json' },
      payload: { count: 1000, seed: 1337 }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.report.datasetSummary.totalRecords).toBe(1000);
    expect(body.report.baselineStrategy).toBeDefined();
    expect(body.report.recoveryOSStrategy).toBeDefined();
    expect(body.report.deltaComparison.incrementalRecoveredRupees).toBeGreaterThan(0);
  });

  it('GET /api/v1/benchmark/report should return standard 10,000 evaluation report', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/benchmark/report'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.standard_evaluation.datasetSummary.totalRecords).toBe(10000);
    expect(body.standard_evaluation.methodology.prngSeed).toBe(1337);
  });
});
