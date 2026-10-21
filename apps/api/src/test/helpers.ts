import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { buildApp } from '../app';
import type { Config } from '../config';
import { createDb, type Db } from '../db/client';
import { loans } from '../db/schema';
import { FakeClock } from '../lib/clock';
import type { OtpSender } from '../modules/auth/otp-sender';
import { TEST_DATABASE_URL } from './env';

/** Records OTPs instead of logging them, so tests read the code directly. */
export class CapturingOtpSender implements OtpSender {
  readonly sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }

  lastCode(phone: string): string {
    const entry = [...this.sent].reverse().find((s) => s.phone === phone);
    if (!entry) throw new Error(`No OTP was sent to ${phone}`);
    return entry.code;
  }
}

const shared = createDb(TEST_DATABASE_URL);

export async function closeTestDb(): Promise<void> {
  await shared.pool.end();
}

export async function resetDb(db: Db = shared.db): Promise<void> {
  await db.execute(sql`TRUNCATE users, otp_challenges, sessions, loans RESTART IDENTITY CASCADE`);
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    HOST: '127.0.0.1',
    DATABASE_URL: TEST_DATABASE_URL,
    OTP_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    OTP_DELIVERY: 'console',
    SESSION_TTL_DAYS: 30,
    UPLOAD_DIR: path.join(os.tmpdir(), 'miniledger-test-uploads'),
    IP_RATE_LIMIT_PER_MINUTE: 1_000_000,
    ...overrides,
  };
}

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  clock: FakeClock;
  otp: CapturingOtpSender;
  /** A throwaway directory that holds this test's uploaded receipts. */
  uploadDir: string;
}

/** A fresh app on an empty database, with a controllable clock, captured OTPs and an empty upload directory. */
export async function buildTestApp(startAt = '2026-10-21T10:00:00Z'): Promise<TestContext> {
  await resetDb();
  const clock = new FakeClock(startAt);
  const otp = new CapturingOtpSender();
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'miniledger-receipts-'));
  const app = await buildApp({
    config: testConfig({ UPLOAD_DIR: uploadDir }),
    db: shared.db,
    clock,
    otpSender: otp,
  });
  await app.ready();
  return { app, db: shared.db, clock, otp, uploadDir };
}

/** Builds a multipart/form-data body holding one file part, for `app.inject()`. */
export function multipartFile(opts: { filename: string; contentType: string; data: Buffer; field?: string }) {
  const boundary = `----miniledger${randomUUID().replace(/-/g, '')}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${opts.field ?? 'file'}"; filename="${opts.filename}"\r\n` +
      `Content-Type: ${opts.contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, opts.data, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/**
 * Opens several pooled connections up front. A cold pool hands out one connection at a time, which would make
 * "simultaneous" requests in a concurrency test run back to back and hide real races.
 */
export async function warmPool(ctx: TestContext, connections = 4): Promise<void> {
  await Promise.all(Array.from({ length: connections }, () => ctx.db.execute(sql`select pg_sleep(0.1)`)));
}

export interface LoanFixture {
  friendName?: string;
  amountMinor?: number;
  dueDate: string;
  repaidAt?: string | null;
  note?: string | null;
}

/** Inserts a loan straight into the database (for fixtures the API can't create, e.g. an already repaid loan). */
export async function insertLoan(ctx: TestContext, userId: string, fixture: LoanFixture): Promise<string> {
  const [row] = await ctx.db
    .insert(loans)
    .values({
      userId,
      friendName: fixture.friendName ?? 'Friend',
      amountMinor: fixture.amountMinor ?? 100000,
      dueDate: fixture.dueDate,
      repaidAt: fixture.repaidAt ? new Date(fixture.repaidAt) : null,
      note: fixture.note ?? null,
    })
    .returning({ id: loans.id });
  return row!.id;
}

export interface LoggedInUser {
  token: string;
  userId: string;
  phone: string;
  headers: { authorization: string };
}

/** Runs the real request-OTP -> verify flow and returns the bearer token. */
export async function loginAs(
  ctx: TestContext,
  rawPhone: string,
  timezone?: string,
): Promise<LoggedInUser> {
  const requested = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: rawPhone } });
  if (requested.statusCode !== 202) throw new Error(`OTP request failed: ${requested.body}`);
  const phoneE164 = ctx.otp.sent[ctx.otp.sent.length - 1]!.phone;
  const verified = await ctx.app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone: rawPhone, code: ctx.otp.lastCode(phoneE164), timezone },
  });
  if (verified.statusCode !== 200) throw new Error(`OTP verify failed: ${verified.body}`);
  const body = verified.json();
  // Moving on from a login must not trip the resend cooldown for the next one in the same test.
  ctx.clock.advanceSeconds(31);
  return {
    token: body.token,
    userId: body.user.id,
    phone: body.user.phone,
    headers: { authorization: `Bearer ${body.token}` },
  };
}
