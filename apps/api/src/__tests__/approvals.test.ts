import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../middleware/auth.middleware.js';

describe('Human-in-the-Loop Approval Endpoints', () => {
  let app: FastifyInstance;
  const merchantId = 'm_approval_test';
  let operatorToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    operatorToken = AuthService.signToken({
      userId: 'usr_operator',
      merchantId,
      email: 'operator@recoveryos.dev',
      role: 'OPERATOR'
    });
    viewerToken = AuthService.signToken({
      userId: 'usr_viewer',
      merchantId,
      email: 'viewer@recoveryos.dev',
      role: 'VIEWER'
    });
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/approvals/pending should return pending list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/approvals/pending',
      headers: { authorization: `Bearer ${operatorToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.pendingApprovals).toBeDefined();
  });

  it('POST /api/v1/cases/:id/approve should block VIEWER role with 403 Forbidden', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/case_test_123/approve',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { notes: 'Attempting unauthorized approval' }
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Forbidden');
  });

  it('POST /api/v1/cases/:id/reject should reject missing case with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/case_nonexistent/reject',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { reason: 'Suspected fraud' }
    });

    // In unit test mode without live DB, returns 400 with clean error message
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Rejection Failed');
  });
});
