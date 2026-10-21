import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';
import type { Db } from './db/client';
import type { Clock } from './lib/clock';
import { registerErrorHandling } from './lib/errors';
import { createAuthenticate } from './modules/auth/auth.plugin';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { createAuthService } from './modules/auth/auth.service';
import { ConsoleOtpSender, type OtpSender } from './modules/auth/otp-sender';
import { registerLoanRoutes } from './modules/loans/loans.routes';
import { createLoansService } from './modules/loans/loans.service';
import { LocalDiskStorage, type ReceiptStorage } from './modules/receipts/receipt-storage';
import { registerReceiptRoutes } from './modules/receipts/receipts.routes';
import { MAX_RECEIPT_BYTES, createReceiptsService } from './modules/receipts/receipts.service';

export interface BuildAppOptions {
  config: Config;
  db: Db;
  clock: Clock;
  /** Defaults to the console sender (prints the OTP in the server log). Tests inject a capturing sender. */
  otpSender?: OtpSender;
  /** Defaults to local disk under UPLOAD_DIR. Tests inject a temp directory. */
  storage?: ReceiptStorage;
}

/**
 * Builds the HTTP app without listening, so tests can drive it in-process with `app.inject()`.
 * Everything with side effects (clock, OTP delivery, database) is passed in.
 */
export async function buildApp({ config, db, clock, otpSender, storage }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : { level: 'info', redact: ['req.headers.authorization'] },
    bodyLimit: 1_000_000,
  });

  registerErrorHandling(app);

  // Coarse per-IP guard. The per-phone OTP limits are enforced separately, in the auth service.
  await app.register(rateLimit, { max: config.IP_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });

  // One file per request, capped while streaming. Uploads are never served statically (see receipts.routes.ts).
  await app.register(multipart, { limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 0, parts: 2 } });

  app.get('/health', async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'degraded', db: 'down' });
    }
  });

  const auth = createAuthService({
    db,
    clock,
    otpSender: otpSender ?? new ConsoleOtpSender(app.log),
    config,
  });
  const authenticate = createAuthenticate(auth);

  registerAuthRoutes(app, auth, authenticate);
  const receiptStorage = storage ?? new LocalDiskStorage(config.UPLOAD_DIR);
  const loansService = createLoansService({ db, clock, storage: receiptStorage });
  registerLoanRoutes(app, loansService, authenticate);
  registerReceiptRoutes(
    app,
    createReceiptsService({ db, clock, storage: receiptStorage, loans: loansService }),
    authenticate,
  );

  return app;
}
