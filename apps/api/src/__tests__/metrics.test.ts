import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { AuthService } from '../middleware/auth.middleware.js';
import { MetricsService } from '../services/metrics.service.js';
import pg from 'pg';

describe('Metrics Service & Overview Endpoints', () => {
  let app: FastifyInstance;
  const merchantId = 'm_metrics_test';
  let token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    token = AuthService.signToken({
      userId: 'usr_admin',
      merchantId,
      email: 'admin@metrics.com',
      role: 'ADMIN'
    });
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('MetricsService.getOverview should aggregate PostgreSQL data accurately', async () => {
    const mockClient = {
      release: vi.fn(),
      query: vi.fn()
        // 1. Core aggregates
        .mockResolvedValueOnce({
          rows: [
            {
              total_cases: 10,
              revenue_at_risk_paise: 1500000, // ₹15,000
              gross_recovered_paise: 900000,  // ₹9,000
              recovered_cases_count: 6
            }
          ]
        })
        // 2. Cases by state
        .mockResolvedValueOnce({
          rows: [
            { state: 'RECOVERED', count: 6 },
            { state: 'ACTION_SCHEDULED', count: 4 }
          ]
        })
        // 3. Cases by failure class
        .mockResolvedValueOnce({
          rows: [
            { failure_class: 'INSUFFICIENT_FUNDS', total: 6, recovered: 5 },
            { failure_class: 'AUTHENTICATION_FAILED', total: 4, recovered: 1 }
          ]
        })
        // 4. Double charges prevented
        .mockResolvedValueOnce({ rows: [{ count: 2 }] })
        // 5. Policy overrides
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        // 6. AI fallback count
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
    } as unknown as pg.PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    } as unknown as pg.Pool;

    const overview = await MetricsService.getOverview(mockPool, merchantId);

    expect(overview.totalCases).toBe(10);
    expect(overview.revenueAtRiskRupees).toBe(15000);
    expect(overview.grossRecoveredRupees).toBe(9000);
    expect(overview.recoveryRatePercent).toBe(60.0);
    expect(overview.doubleChargesPreventedCount).toBe(2);
    expect(overview.policyOverridesCount).toBe(3);
    expect(overview.aiFallbackCount).toBe(1);
    expect(overview.casesByState['RECOVERED']).toBe(6);
    expect(overview.casesByFailureClass['INSUFFICIENT_FUNDS'].rate).toBe(83.33);
  });

  it('GET /api/v1/metrics/overview should return status 200 with authenticated token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/overview',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.metrics).toBeDefined();
  });
});
