import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService, requireAuth, UserRole } from '../middleware/auth.middleware.js';

const ROLE_USER_MAP: Record<UserRole, string> = {
  ADMIN: '22222222-2222-2222-2222-222222222222',
  OPERATOR: '33333333-3333-3333-3333-333333333333',
  VIEWER: '44444444-4444-4444-4444-444444444444',
};

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/auth/demo-token', async (request, reply) => {
    const body = request.body as {
      role?: UserRole;
      merchantId?: string;
      email?: string;
    };

    const role = body?.role || 'ADMIN';
    const merchantId = body?.merchantId || '00000000-0000-0000-0000-000000000000';
    const email = body?.email || `${role.toLowerCase()}@acme.dev`;
    const userId = ROLE_USER_MAP[role] || ROLE_USER_MAP.ADMIN;

    const token = AuthService.signToken({
      userId,
      merchantId,
      email,
      role,
    });

    return reply.send({
      success: true,
      token,
      session: {
        userId,
        merchantId,
        email,
        role,
      },
    });
  });

  fastify.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({
      authenticated: true,
      user: request.auth,
    });
  });
};
