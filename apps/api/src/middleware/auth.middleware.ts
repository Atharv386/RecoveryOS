import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthSession {
  userId: string;
  merchantId: string;
  email: string;
  role: UserRole;
  expiresAt: number;
}

// Extend FastifyRequest type to include authenticated user context
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthSession;
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'recoveryos_default_session_secret_32_chars_minimum';

export class AuthService {
  /**
   * Signs a secure session payload using HMAC SHA-256.
   */
  public static signToken(session: Omit<AuthSession, 'expiresAt'>, ttlSeconds: number = 86400): string {
    const payload: AuthSession = {
      ...session,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  /**
   * Verifies and decodes a signed session token.
   */
  public static verifyToken(token: string): AuthSession | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;

      const [encodedPayload, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(encodedPayload)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AuthSession;
      if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }

      return payload;
    } catch {
      return null;
    }
  }
}

/**
 * Fastify middleware enforcing valid session authentication and tenant injection.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const cookieToken = (request.headers.cookie || '')
    .split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1];

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    // In demo/test mode with X-Demo-Mode header, allow demo admin session
    if (request.headers['x-demo-mode'] === 'true' || process.env.DEMO_MODE === 'true') {
      request.auth = {
        userId: '22222222-2222-2222-2222-222222222222',
        merchantId: (request.headers['x-merchant-id'] as string) || '00000000-0000-0000-0000-000000000000',
        email: 'demo@recoveryos.dev',
        role: 'ADMIN',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };
      return;
    }

    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid Bearer token or session cookie.'
    });
  }

  const session = AuthService.verifyToken(token);
  if (!session) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired session token.'
    });
  }

  request.auth = session;
}

/**
 * Middleware enforcing specific role permissions.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (!request.auth) return;

    if (!allowedRoles.includes(request.auth.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: [${allowedRoles.join(', ')}], current role: ${request.auth.role}`
      });
    }
  };
}
