import type { FastifyRequest } from 'fastify';
import { errors } from '../../lib/errors';
import type { AuthService, AuthUser } from './auth.service';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` hook on protected routes. */
    user: AuthUser;
    sessionToken: string;
  }
}

/** Pulls the token out of "Authorization: Bearer <token>"; null for anything else. */
export function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  return token;
}

/** preHandler hook: resolves the bearer token to a user, or responds 401. */
export function createAuthenticate(auth: AuthService) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const token = extractBearerToken(request);
    if (!token) throw errors.unauthenticated();
    const user = await auth.authenticate(token);
    if (!user) throw errors.unauthenticated();
    request.user = user;
    request.sessionToken = token;
  };
}
