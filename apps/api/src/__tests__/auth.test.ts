import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../middleware/auth.middleware.js';

describe('Authentication & RBAC Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('AuthService should sign and verify tokens with HMAC signature', () => {
    const session = {
      userId: 'usr_1',
      merchantId: 'm_100',
      email: 'admin@acme.com',
      role: 'ADMIN' as const
    };

    const token = AuthService.signToken(session);
    const verified = AuthService.verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('usr_1');
    expect(verified?.merchantId).toBe('m_100');
    expect(verified?.role).toBe('ADMIN');
  });

  it('AuthService should reject tampered session tokens', () => {
    const token = AuthService.signToken({
      userId: 'usr_1',
      merchantId: 'm_100',
      email: 'admin@acme.com',
      role: 'ADMIN'
    });

    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(AuthService.verifyToken(tampered)).toBeNull();
  });

  it('GET /api/v1/auth/me should reject unauthenticated requests with 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me'
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET /api/v1/auth/me should accept valid Bearer token and return user session', async () => {
    const token = AuthService.signToken({
      userId: 'usr_operator_1',
      merchantId: 'm_100',
      email: 'ops@acme.com',
      role: 'OPERATOR'
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.authenticated).toBe(true);
    expect(body.user.email).toBe('ops@acme.com');
    expect(body.user.role).toBe('OPERATOR');
  });
});
