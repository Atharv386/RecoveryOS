import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../middleware/auth.middleware.js';

describe('High-Value Priority Queue & Recovery Probability (Blueprint Section 10)', () => {
  let app: FastifyInstance;
  const merchantId = 'm_priority_test';
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    token = AuthService.signToken({
      userId: 'usr_ops',
      merchantId,
      email: 'ops@acme.com',
      role: 'OPERATOR'
    });
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/cases/priority-queue should return ranked recovery opportunities', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/priority-queue',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.priorityQueue).toBeDefined();
  });
});
