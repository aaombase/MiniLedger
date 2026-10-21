import {
  activityQuerySchema,
  createLoanSchema,
  listLoansQuerySchema,
  recordPaymentSchema,
  updateLoanSchema,
} from '@miniledger/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { parseInput } from '../../lib/validate';
import type { LoansService } from './loans.service';

interface IdParams {
  id: string;
}

export function registerLoanRoutes(
  app: FastifyInstance,
  loans: LoansService,
  authenticate: preHandlerAsyncHookHandler,
): void {
  // Everything registered in this scope requires a valid session; a new route can't forget the check.
  app.register(async (scope) => {
    scope.addHook('preHandler', authenticate);

    scope.get('/v1/loans', async (request) => {
      const { status } = parseInput(listLoansQuerySchema, request.query);
      return loans.list(request.user, status);
    });

    scope.post('/v1/loans', async (request, reply) => {
      // The allowed due-date window depends on the user's "today", so the schema is built per request.
      const input = parseInput(createLoanSchema(loans.todayFor(request.user)), request.body);
      return reply.status(201).send(await loans.create(request.user, input));
    });

    scope.get<{ Params: IdParams }>('/v1/loans/:id', async (request) => loans.get(request.user, request.params.id));

    scope.post<{ Params: IdParams }>('/v1/loans/:id/repay', async (request) =>
      loans.repay(request.user, request.params.id),
    );

    scope.patch<{ Params: IdParams }>('/v1/loans/:id', async (request) => {
      const changes = parseInput(updateLoanSchema(loans.todayFor(request.user)), request.body);
      return loans.update(request.user, request.params.id, changes);
    });

    scope.delete<{ Params: IdParams }>('/v1/loans/:id', async (request, reply) => {
      await loans.remove(request.user, request.params.id);
      return reply.status(204).send();
    });

    scope.post<{ Params: IdParams }>('/v1/loans/:id/payments', async (request, reply) => {
      const input = parseInput(recordPaymentSchema(loans.todayFor(request.user)), request.body);
      return reply.status(201).send(await loans.recordPayment(request.user, request.params.id, input));
    });

    scope.get('/v1/activity', async (request) => {
      const { limit } = parseInput(activityQuerySchema, request.query);
      return loans.activity(request.user, limit);
    });

    scope.get('/v1/summary', async (request) => loans.summary(request.user));
  });
}
