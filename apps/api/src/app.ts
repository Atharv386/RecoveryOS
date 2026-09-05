import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';
import { caseRoutes } from './routes/cases.js';
import { chaosRoutes } from './routes/chaos.js';
import { simulatorRoutes } from './routes/simulator.js';
import { benchmarkRoutes } from './routes/benchmark.js';
import { authRoutes } from './routes/auth.js';
import { metricsRoutes } from './routes/metrics.js';
import { approvalRoutes } from './routes/approvals.js';
import { demoRoutes } from './routes/demo.js';
import { priorityQueueRoutes } from './routes/priority-queue.js';
import { auditRoutes } from './routes/audit.js';
import { merchantRoutes } from './routes/merchants.js';
import { dashboardRoutes } from './routes/dashboard.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test'
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register API routes
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(authRoutes, { prefix: '/api/v1' });
  await fastify.register(webhookRoutes, { prefix: '/api/v1' });
  await fastify.register(caseRoutes, { prefix: '/api/v1' });
  await fastify.register(priorityQueueRoutes, { prefix: '/api/v1' });
  await fastify.register(metricsRoutes, { prefix: '/api/v1' });
  await fastify.register(approvalRoutes, { prefix: '/api/v1' });
  await fastify.register(chaosRoutes, { prefix: '/api/v1' });
  await fastify.register(simulatorRoutes, { prefix: '/api/v1' });
  await fastify.register(benchmarkRoutes, { prefix: '/api/v1' });
  await fastify.register(demoRoutes, { prefix: '/api/v1' });
  await fastify.register(auditRoutes, { prefix: '/api/v1' });
  await fastify.register(merchantRoutes, { prefix: '/api/v1' });
  await fastify.register(dashboardRoutes);

  return fastify;
}
