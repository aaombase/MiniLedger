import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, closeTestDb, loginAs, warmPool, type TestContext } from '../../test/helpers';
import { ConsoleOtpSender } from './otp-sender';

const PHONE = '+919876543210';
const RAW_PHONE = '98765 43210';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await buildTestApp();
});

afterAll(closeTestDb);

const requestOtp = (phone = RAW_PHONE) =>
  ctx.app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });

const verifyOtp = (code: string, extra: Record<string, unknown> = {}, phone = RAW_PHONE) =>
  ctx.app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code, ...extra } });

describe('GET /health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('error envelope', () => {
  it('answers unknown routes with a NOT_FOUND envelope', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('answers malformed JSON with BAD_REQUEST, not a stack trace', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      headers: { 'content-type': 'application/json' },
      payload: '{"phone": ',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    expect(res.body).not.toContain('at ');
  });
});

describe('ConsoleOtpSender', () => {
  it('prints the code and a clear MOCK OTP marker', async () => {
    const lines: string[] = [];
    await new ConsoleOtpSender({ info: (m) => lines.push(m) }).send(PHONE, '482913', new Date('2026-10-21T10:05:00Z'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[MOCK OTP]');
    expect(lines[0]).toContain('+91 98765 43210');
    expect(lines[0]).toContain('482913');
  });
});

describe('POST /v1/auth/otp/request', () => {
  it('accepts a valid phone and sends a 6 digit code to the normalized number', async () => {
    const res = await requestOtp();
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
    expect(ctx.otp.sent).toHaveLength(1);
    expect(ctx.otp.sent[0]!.phone).toBe(PHONE);
    expect(ctx.otp.sent[0]!.code).toMatch(/^\d{6}$/);
  });

  it('rejects an invalid phone with a field error', async () => {
    const res = await requestOtp('12345');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details).toHaveProperty('phone');
    expect(ctx.otp.sent).toHaveLength(0);
  });

  it('never stores the plaintext code', async () => {
    await requestOtp();
    const code = ctx.otp.lastCode(PHONE);
    const rows = (await ctx.db.execute(sql`select code_hash from otp_challenges`)).rows as { code_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code_hash).not.toContain(code);
    expect(rows[0]!.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enforces a 30 second resend cooldown', async () => {
    await requestOtp();
    ctx.clock.advanceSeconds(10);
    const blocked = await requestOtp();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('OTP_RATE_LIMITED');
    expect(blocked.json().error.details.retryAfterSeconds).toBe(20);
    expect(blocked.headers['retry-after']).toBe('20');

    ctx.clock.advanceSeconds(21);
    expect((await requestOtp()).statusCode).toBe(202);
  });

  it('caps requests at 5 per hour per phone', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await requestOtp()).statusCode).toBe(202);
      ctx.clock.advanceSeconds(31);
    }
    const blocked = await requestOtp();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('OTP_RATE_LIMITED');
    expect(blocked.json().error.details.retryAfterSeconds).toBeGreaterThan(30);

    ctx.clock.advanceSeconds(3600);
    expect((await requestOtp()).statusCode).toBe(202);
  });

  it('does not rate limit one phone because of another', async () => {
    await requestOtp('98765 43210');
    expect((await requestOtp('98765 43211')).statusCode).toBe(202);
  });
});

describe('POST /v1/auth/otp/verify', () => {
  it('logs in with the correct code and returns a working session', async () => {
    await requestOtp();
    const res = await verifyOtp(ctx.otp.lastCode(PHONE), { timezone: 'America/New_York' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.phone).toBe(PHONE);
    expect(body.user.timezone).toBe('America/New_York');
    expect(typeof body.token).toBe('string');
    expect(new Date(body.expiresAt).getTime()).toBe(Date.parse('2026-10-21T10:00:00Z') + 30 * 86_400_000);

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ id: body.user.id, phone: PHONE, timezone: 'America/New_York' });
  });

  it('treats differently formatted versions of the same number as one user', async () => {
    await requestOtp('98765 43210');
    const first = await verifyOtp(ctx.otp.lastCode(PHONE), {}, '+919876543210');
    ctx.clock.advanceSeconds(31);
    await requestOtp('09876543210');
    const second = await verifyOtp(ctx.otp.lastCode(PHONE), {}, '+91 98765-43210');
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().user.id).toBe(first.json().user.id);
  });

  it('falls back to the default timezone when the device sends junk', async () => {
    await requestOtp();
    const res = await verifyOtp(ctx.otp.lastCode(PHONE), { timezone: 'Mars/Olympus' });
    expect(res.json().user.timezone).toBe('Asia/Kolkata');
  });

  it('stores only a hash of the session token', async () => {
    await requestOtp();
    const { token } = (await verifyOtp(ctx.otp.lastCode(PHONE))).json();
    const rows = (await ctx.db.execute(sql`select token_hash from sessions`)).rows as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(token);
    expect(rows[0]!.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('rejects a malformed code before touching the challenge', async () => {
    await requestOtp();
    const res = await verifyOtp('12345');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details).toHaveProperty('code');
  });

  it('reports remaining attempts on wrong codes', async () => {
    await requestOtp();
    const wrong = ctx.otp.lastCode(PHONE) === '000000' ? '111111' : '000000';
    for (const remaining of [4, 3, 2, 1]) {
      const res = await verifyOtp(wrong);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('OTP_INVALID');
      expect(res.json().error.details.attemptsRemaining).toBe(remaining);
    }
  });

  it('locks the challenge after 5 wrong guesses, even for the correct code', async () => {
    await requestOtp();
    const correct = ctx.otp.lastCode(PHONE);
    const wrong = correct === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await verifyOtp(wrong);

    const fifth = await verifyOtp(wrong);
    expect(fifth.statusCode).toBe(429);
    expect(fifth.json().error.code).toBe('OTP_TOO_MANY_ATTEMPTS');

    const afterLock = await verifyOtp(correct);
    expect(afterLock.statusCode).toBe(400);
    expect(afterLock.json().error.code).toBe('OTP_EXPIRED');
  });

  it('rejects an expired code', async () => {
    await requestOtp();
    const code = ctx.otp.lastCode(PHONE);
    ctx.clock.advanceSeconds(301);
    const res = await verifyOtp(code);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OTP_EXPIRED');
  });

  it('still accepts the code just before it expires', async () => {
    await requestOtp();
    const code = ctx.otp.lastCode(PHONE);
    ctx.clock.advanceSeconds(299);
    expect((await verifyOtp(code)).statusCode).toBe(200);
  });

  it('cannot be reused after a successful login', async () => {
    await requestOtp();
    const code = ctx.otp.lastCode(PHONE);
    expect((await verifyOtp(code)).statusCode).toBe(200);
    const again = await verifyOtp(code);
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('OTP_EXPIRED');
  });

  it('invalidates the previous code when a new one is requested', async () => {
    await requestOtp();
    const first = ctx.otp.lastCode(PHONE);
    ctx.clock.advanceSeconds(31);
    await requestOtp();
    const second = ctx.otp.lastCode(PHONE);
    if (first === second) return; // 1-in-a-million collision; nothing to assert

    expect((await verifyOtp(first)).json().error.code).toBe('OTP_INVALID');
    expect((await verifyOtp(second)).statusCode).toBe(200);
  });

  it('answers OTP_EXPIRED when no code was ever requested', async () => {
    const res = await verifyOtp('123456');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OTP_EXPIRED');
  });

  it('lets exactly one of many simultaneous verifies with the correct code succeed', async () => {
    await requestOtp();
    const code = ctx.otp.lastCode(PHONE);
    await warmPool(ctx); // otherwise the "simultaneous" requests run back to back and can't catch a race
    const results = await Promise.all(Array.from({ length: 4 }, () => verifyOtp(code)));
    const statuses = results.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400)).toHaveLength(3);
  });
});

describe('authentication on protected routes', () => {
  it('rejects a missing token', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a garbage or malformed token', async () => {
    for (const authorization of ['Bearer nonsense', 'Basic abc', 'Bearer', 'nonsense']) {
      const res = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: { authorization } });
      expect(res.statusCode).toBe(401);
    }
  });

  it('rejects a token after its session expires', async () => {
    const user = await loginAs(ctx, RAW_PHONE);
    ctx.clock.advanceSeconds(30 * 86_400 + 60);
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: user.headers });
    expect(res.statusCode).toBe(401);
  });

  it('logout revokes the session', async () => {
    const user = await loginAs(ctx, RAW_PHONE);
    const out = await ctx.app.inject({ method: 'POST', url: '/v1/auth/logout', headers: user.headers });
    expect(out.statusCode).toBe(204);
    const after = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: user.headers });
    expect(after.statusCode).toBe(401);
  });

  it('logout only revokes the current session, not the same user\'s other devices', async () => {
    const phoneOne = await loginAs(ctx, RAW_PHONE);
    const phoneTwo = await loginAs(ctx, RAW_PHONE);
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/logout', headers: phoneOne.headers });
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: phoneTwo.headers });
    expect(res.statusCode).toBe(200);
  });
});
