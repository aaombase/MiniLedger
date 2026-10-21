import { requestOtpSchema, verifyOtpSchema } from '@miniledger/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { parseInput } from '../../lib/validate';
import type { AuthService } from './auth.service';

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  authenticate: preHandlerAsyncHookHandler,
): void {
  app.post('/v1/auth/otp/request', async (request, reply) => {
    const { phone } = parseInput(requestOtpSchema, request.body);
    const result = await auth.requestOtp(phone);
    return reply.status(202).send(result);
  });

  app.post('/v1/auth/otp/verify', async (request) => {
    const { phone, code, timezone } = parseInput(verifyOtpSchema, request.body);
    return auth.verifyOtp(phone, code, timezone);
  });

  app.post('/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    await auth.logout(request.sessionToken);
    return reply.status(204).send();
  });

  app.get('/v1/me', { preHandler: authenticate }, async (request) => ({
    id: request.user.id,
    phone: request.user.phone,
    timezone: request.user.timezone,
  }));
}
