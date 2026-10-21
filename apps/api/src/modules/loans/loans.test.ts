import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestApp,
  closeTestDb,
  insertLoan,
  loginAs,
  warmPool,
  type LoggedInUser,
  type TestContext,
} from '../../test/helpers';

// Clock is 2026-10-21 10:00 UTC = 15:30 IST, so "today" for the default (Kolkata) user is 2026-10-21.
const TODAY = '2026-10-21';

let ctx: TestContext;
let alice: LoggedInUser;
let bob: LoggedInUser;

beforeEach(async () => {
  ctx = await buildTestApp();
  alice = await loginAs(ctx, '98765 43210');
  bob = await loginAs(ctx, '98765 43211');
});

afterAll(closeTestDb);

const post = (url: string, user: LoggedInUser | null, payload?: unknown) =>
  ctx.app.inject({ method: 'POST', url, headers: user?.headers, payload: payload as object });
const get = (url: string, user: LoggedInUser | null) =>
  ctx.app.inject({ method: 'GET', url, headers: user?.headers });

const validLoan = { friendName: 'Rohan', amountMinor: 150050, dueDate: '2026-11-05' };

describe('every loan route requires authentication', () => {
  const FAKE_ID = '00000000-0000-4000-8000-000000000000';
  it.each([
    ['GET', '/v1/loans'],
    ['POST', '/v1/loans'],
    ['GET', `/v1/loans/${FAKE_ID}`],
    ['POST', `/v1/loans/${FAKE_ID}/repay`],
    ['GET', '/v1/summary'],
    ['GET', '/v1/me'],
    ['POST', '/v1/auth/logout'],
  ] as const)('%s %s without a token -> 401', async (method, url) => {
    const res = await ctx.app.inject({ method, url });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /v1/loans', () => {
  it('creates a loan and returns it with derived fields', async () => {
    const res = await post('/v1/loans', alice, { ...validLoan, note: 'Concert tickets' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      friendName: 'Rohan',
      amountMinor: 150050,
      currency: 'INR',
      dueDate: '2026-11-05',
      note: 'Concert tickets',
      status: 'pending',
      daysUntilDue: 15,
      repaidAt: null,
      hasReceipt: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      paidMinor: 0,
      remainingMinor: 150050,
      lastPaymentOn: null,
    });
  });

  it('stores the amount as integer paise and the due date as a plain date', async () => {
    await post('/v1/loans', alice, validLoan);
    const rows = (await ctx.db.execute(
      sql`select amount_minor::text as amount, due_date::text as due from loans`,
    )).rows as { amount: string; due: string }[];
    expect(rows).toEqual([{ amount: '150050', due: '2026-11-05' }]);
  });

  it('allows a due date in the past - the loan is simply overdue', async () => {
    const res = await post('/v1/loans', alice, { ...validLoan, dueDate: '2026-10-16' });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('overdue');
    expect(res.json().daysUntilDue).toBe(-5);
  });

  it('treats a loan due today as due soon, not overdue', async () => {
    const res = await post('/v1/loans', alice, { ...validLoan, dueDate: TODAY });
    expect(res.json().status).toBe('due_soon');
    expect(res.json().daysUntilDue).toBe(0);
  });

  it.each([
    ['friendName', { friendName: '' }],
    ['friendName', { friendName: 'x'.repeat(61) }],
    ['friendName', { friendName: undefined }],
    ['amountMinor', { amountMinor: 0 }],
    ['amountMinor', { amountMinor: -500 }],
    ['amountMinor', { amountMinor: 99 }],
    ['amountMinor', { amountMinor: 100_000_001 }],
    ['amountMinor', { amountMinor: 1500.5 }],
    ['amountMinor', { amountMinor: '1500' }],
    ['dueDate', { dueDate: '2026-02-30' }],
    ['dueDate', { dueDate: '05/11/2026' }],
    ['dueDate', { dueDate: undefined }],
    ['dueDate', { dueDate: '2036-10-21' }],
    ['note', { note: 'n'.repeat(201) }],
  ])('rejects an invalid %s with a field error', async (field, override) => {
    const res = await post('/v1/loans', alice, { ...validLoan, ...override });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details).toHaveProperty(field);
    const count = (await ctx.db.execute(sql`select count(*)::int as n from loans`)).rows[0] as { n: number };
    expect(count.n).toBe(0);
  });

  it('rejects an empty body', async () => {
    const res = await post('/v1/loans', alice);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores client-supplied ownership and repayment fields (no mass assignment)', async () => {
    const res = await post('/v1/loans', alice, {
      ...validLoan,
      userId: bob.userId,
      repaidAt: '2026-10-01T00:00:00Z',
      id: '11111111-1111-4111-8111-111111111111',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).not.toBe('repaid');
    expect(res.json().id).not.toBe('11111111-1111-4111-8111-111111111111');
    expect((await get('/v1/loans', bob)).json().loans).toHaveLength(0);
    expect((await get('/v1/loans', alice)).json().loans).toHaveLength(1);
  });
});

describe('GET /v1/loans', () => {
  it('returns an empty list and asOf for a new user', async () => {
    const res = await get('/v1/loans', alice);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ asOf: TODAY, loans: [] });
  });

  describe('with a mixed ledger', () => {
    beforeEach(async () => {
      const u = alice.userId;
      await insertLoan(ctx, u, { friendName: 'F-pending-far', dueDate: '2026-12-20' });
      await insertLoan(ctx, u, { friendName: 'G-repaid-early', dueDate: '2026-10-11', repaidAt: '2026-10-19T08:00:00Z' });
      await insertLoan(ctx, u, { friendName: 'B-overdue-recent', dueDate: '2026-10-18' });
      await insertLoan(ctx, u, { friendName: 'D-soon-3d', dueDate: '2026-10-24' });
      await insertLoan(ctx, u, { friendName: 'A-overdue-oldest', dueDate: '2026-10-09' });
      await insertLoan(ctx, u, { friendName: 'H-repaid-late', dueDate: '2026-10-01', repaidAt: '2026-10-20T08:00:00Z' });
      await insertLoan(ctx, u, { friendName: 'E-pending-4d', dueDate: '2026-10-25' });
      await insertLoan(ctx, u, { friendName: 'C-due-today', dueDate: TODAY });
    });

    it('orders by urgency: overdue (oldest first), due soon, pending, then repaid (latest first)', async () => {
      const names = (await get('/v1/loans', alice)).json().loans.map((l: { friendName: string }) => l.friendName);
      expect(names).toEqual([
        'A-overdue-oldest',
        'B-overdue-recent',
        'C-due-today',
        'D-soon-3d',
        'E-pending-4d',
        'F-pending-far',
        'H-repaid-late',
        'G-repaid-early',
      ]);
    });

    it('derives status correctly on every boundary', async () => {
      const loans = (await get('/v1/loans', alice)).json().loans as { friendName: string; status: string; daysUntilDue: number | null }[];
      const byName = Object.fromEntries(loans.map((l) => [l.friendName, l]));
      expect(byName['B-overdue-recent']).toMatchObject({ status: 'overdue', daysUntilDue: -3 });
      expect(byName['C-due-today']).toMatchObject({ status: 'due_soon', daysUntilDue: 0 });
      expect(byName['D-soon-3d']).toMatchObject({ status: 'due_soon', daysUntilDue: 3 });
      expect(byName['E-pending-4d']).toMatchObject({ status: 'pending', daysUntilDue: 4 });
      expect(byName['G-repaid-early']).toMatchObject({ status: 'repaid', daysUntilDue: null });
    });

    it.each([
      ['overdue', ['A-overdue-oldest', 'B-overdue-recent']],
      ['outstanding', ['A-overdue-oldest', 'B-overdue-recent', 'C-due-today', 'D-soon-3d', 'E-pending-4d', 'F-pending-far']],
      ['repaid', ['H-repaid-late', 'G-repaid-early']],
    ])('filters by status=%s', async (filter, expected) => {
      const names = (await get(`/v1/loans?status=${filter}`, alice)).json().loans.map((l: { friendName: string }) => l.friendName);
      expect(names).toEqual(expected);
    });

    it('rejects an unknown filter', async () => {
      const res = await get('/v1/loans?status=pending', alice);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  it("only returns the caller's loans", async () => {
    await insertLoan(ctx, alice.userId, { friendName: 'Alice-loan', dueDate: '2026-11-01' });
    await insertLoan(ctx, bob.userId, { friendName: 'Bob-loan', dueDate: '2026-11-01' });
    const aliceNames = (await get('/v1/loans', alice)).json().loans.map((l: { friendName: string }) => l.friendName);
    const bobNames = (await get('/v1/loans', bob)).json().loans.map((l: { friendName: string }) => l.friendName);
    expect(aliceNames).toEqual(['Alice-loan']);
    expect(bobNames).toEqual(['Bob-loan']);
  });

  it("computes 'today' in each user's own timezone", async () => {
    // 18:45 UTC on 21 Oct is already 22 Oct 00:15 in Kolkata, but still 21 Oct afternoon in New York.
    ctx.clock.set('2026-10-21T18:45:00Z');
    const kolkata = await loginAs(ctx, '98765 43212', 'Asia/Kolkata');
    const newYork = await loginAs(ctx, '+1 415 555 2671', 'America/New_York');
    ctx.clock.set('2026-10-21T18:45:00Z');
    await insertLoan(ctx, kolkata.userId, { dueDate: '2026-10-21' });
    await insertLoan(ctx, newYork.userId, { dueDate: '2026-10-21' });

    const k = (await get('/v1/loans', kolkata)).json();
    const n = (await get('/v1/loans', newYork)).json();
    expect(k.asOf).toBe('2026-10-22');
    expect(k.loans[0].status).toBe('overdue');
    expect(n.asOf).toBe('2026-10-21');
    expect(n.loans[0].status).toBe('due_soon');
  });
});

describe('GET /v1/loans/:id', () => {
  it('returns the owner their loan', async () => {
    const id = await insertLoan(ctx, alice.userId, { friendName: 'Priya', dueDate: '2026-10-18', note: 'Dinner' });
    const res = await get(`/v1/loans/${id}`, alice);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, friendName: 'Priya', status: 'overdue', note: 'Dinner' });
  });

  it("returns 404 for another user's loan, indistinguishable from a missing one", async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const foreign = await get(`/v1/loans/${id}`, bob);
    const missing = await get('/v1/loans/00000000-0000-4000-8000-000000000000', bob);
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual(missing.json());
    expect(foreign.json().error.code).toBe('LOAN_NOT_FOUND');
  });

  it('returns 404 (not 400/500) for a malformed id', async () => {
    for (const id of ['abc', '123', 'not-a-uuid', '%27%20OR%201=1']) {
      const res = await get(`/v1/loans/${id}`, alice);
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
    }
  });
});

describe('POST /v1/loans/:id/repay', () => {
  it('marks the loan as repaid with the current time', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-10-16', amountMinor: 250000 });
    const repaidAt = ctx.clock.now().toISOString();
    const res = await post(`/v1/loans/${id}/repay`, alice);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, status: 'repaid', daysUntilDue: null, repaidAt });
    expect((await get(`/v1/loans/${id}`, alice)).json().status).toBe('repaid');
  });

  it('rejects a second repayment with 409 and keeps the original timestamp', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const firstRepaidAt = ctx.clock.now().toISOString();
    await post(`/v1/loans/${id}/repay`, alice);
    ctx.clock.advanceSeconds(3600);
    const again = await post(`/v1/loans/${id}/repay`, alice);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('LOAN_ALREADY_REPAID');
    expect((await get(`/v1/loans/${id}`, alice)).json().repaidAt).toBe(firstRepaidAt);
  });

  it("cannot repay another user's loan, and leaves it untouched", async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const res = await post(`/v1/loans/${id}/repay`, bob);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
    expect((await get(`/v1/loans/${id}`, alice)).json().status).toBe('pending');
  });

  it('returns 404 for a malformed or unknown id', async () => {
    expect((await post('/v1/loans/nope/repay', alice)).statusCode).toBe(404);
    expect((await post('/v1/loans/00000000-0000-4000-8000-000000000000/repay', alice)).statusCode).toBe(404);
  });

  it('lets exactly one of many simultaneous repayments succeed', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    await warmPool(ctx);
    const results = await Promise.all(Array.from({ length: 4 }, () => post(`/v1/loans/${id}/repay`, alice)));
    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
  });
});
