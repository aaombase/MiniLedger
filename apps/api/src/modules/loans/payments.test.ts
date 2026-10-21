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

// Clock is 2026-10-21 10:00 UTC, so "today" for a Kolkata user is 2026-10-21.
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
const get = (url: string, user: LoggedInUser | null) => ctx.app.inject({ method: 'GET', url, headers: user?.headers });
const pay = (id: string, user: LoggedInUser | null, payload: unknown) => post(`/v1/loans/${id}/payments`, user, payload);

async function paymentRows(loanId: string): Promise<number> {
  const r = await ctx.db.execute(sql`SELECT count(*)::int AS n FROM payments WHERE loan_id = ${loanId}`);
  return Number((r.rows[0] as { n: number }).n);
}

describe('POST /v1/loans/:id/payments', () => {
  it('requires authentication', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    expect((await pay(id, null, { amountMinor: 100 })).statusCode).toBe(401);
  });

  it('records a partial payment and keeps the loan open', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    const res = await pay(id, alice, { amountMinor: 40000, note: 'GPay' });
    expect(res.statusCode).toBe(201);
    const loan = res.json();
    expect(loan).toMatchObject({
      id,
      status: 'pending',
      repaidAt: null,
      paidMinor: 40000,
      remainingMinor: 60000,
      lastPaymentOn: TODAY,
    });
    expect(loan.payments).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        amountMinor: 40000,
        paidOn: TODAY,
        note: 'GPay',
        createdAt: ctx.clock.now().toISOString(),
      },
    ]);
  });

  it('marks the loan repaid when the payments reach the full amount', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-10-10', amountMinor: 100000 });
    await pay(id, alice, { amountMinor: 30000 });
    ctx.clock.advanceSeconds(60);
    const res = await pay(id, alice, { amountMinor: 70000 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      status: 'repaid',
      repaidAt: ctx.clock.now().toISOString(),
      paidMinor: 100000,
      remainingMinor: 0,
      daysUntilDue: null,
    });
  });

  it('rejects a payment larger than the remaining balance and records nothing', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await pay(id, alice, { amountMinor: 60000 });
    const res = await pay(id, alice, { amountMinor: 40001 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'AMOUNT_EXCEEDS_BALANCE', details: { remainingMinor: 40000 } });
    expect(await paymentRows(id)).toBe(1);
  });

  it('rejects a payment on a loan that is already repaid', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', repaidAt: '2026-10-20T08:00:00Z' });
    const res = await pay(id, alice, { amountMinor: 100 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LOAN_ALREADY_REPAID');
  });

  it("cannot pay into another user's loan", async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const res = await pay(id, bob, { amountMinor: 5000 });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
    expect(await paymentRows(id)).toBe(0);
  });

  it('returns 404 for a malformed id', async () => {
    expect((await pay('nope', alice, { amountMinor: 5000 })).statusCode).toBe(404);
  });

  it.each([
    ['missing amount', {}],
    ['zero', { amountMinor: 0 }],
    ['below ₹1', { amountMinor: 99 }],
    ['fractional paise', { amountMinor: 100.5 }],
    ['amount as a string', { amountMinor: '5000' }],
    ['a future date', { amountMinor: 5000, paidOn: '2026-10-22' }],
    ['an impossible date', { amountMinor: 5000, paidOn: '2026-02-30' }],
    ['a note over 200 characters', { amountMinor: 5000, note: 'x'.repeat(201) }],
  ])('rejects %s with 400', async (_label, payload) => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const res = await pay(id, alice, payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(await paymentRows(id)).toBe(0);
  });

  it('accepts a back-dated payment', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    const res = await pay(id, alice, { amountMinor: 5000, paidOn: '2026-10-15' });
    expect(res.statusCode).toBe(201);
    expect(res.json().payments[0].paidOn).toBe('2026-10-15');
  });

  it('never lets simultaneous payments exceed the loan amount', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await warmPool(ctx);
    const results = await Promise.all(Array.from({ length: 4 }, () => pay(id, alice, { amountMinor: 60000 })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422, 422, 422]);
    expect((await get(`/v1/loans/${id}`, alice)).json().paidMinor).toBe(60000);
  });
});

describe('repay after partial payments', () => {
  it('settles exactly the remaining balance', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await pay(id, alice, { amountMinor: 25000 });
    ctx.clock.advanceSeconds(60);
    const res = await post(`/v1/loans/${id}/repay`, alice);
    expect(res.statusCode).toBe(200);
    const loan = res.json();
    expect(loan).toMatchObject({ status: 'repaid', paidMinor: 100000, remainingMinor: 0 });
    expect(loan.payments.map((p: { amountMinor: number }) => p.amountMinor)).toEqual([75000, 25000]);
  });
});

describe('payment fields on reads', () => {
  it('lists payments newest first on the loan detail', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await pay(id, alice, { amountMinor: 1000, paidOn: '2026-10-10' });
    ctx.clock.advanceSeconds(60);
    await pay(id, alice, { amountMinor: 2000 });
    const loan = (await get(`/v1/loans/${id}`, alice)).json();
    expect(loan.payments.map((p: { amountMinor: number }) => p.amountMinor)).toEqual([2000, 1000]);
    expect(loan).toMatchObject({ paidMinor: 3000, remainingMinor: 97000, lastPaymentOn: TODAY });
  });

  it('includes paid and remaining amounts in the list, without the payment history', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await pay(id, alice, { amountMinor: 1000 });
    const [loan] = (await get('/v1/loans', alice)).json().loans;
    expect(loan).toMatchObject({ id, paidMinor: 1000, remainingMinor: 99000 });
    expect(loan.payments).toBeUndefined();
  });

  it('treats a loan repaid without payment rows as fully paid', async () => {
    const id = await insertLoan(ctx, alice.userId, {
      dueDate: '2026-10-01',
      amountMinor: 50000,
      repaidAt: '2026-10-05T08:00:00Z',
    });
    expect((await get(`/v1/loans/${id}`, alice)).json()).toMatchObject({ paidMinor: 50000, remainingMinor: 0 });
  });
});

describe('summary with partial payments', () => {
  it('counts partial payments as repaid money and only the unpaid part as overdue', async () => {
    const overdue = await insertLoan(ctx, alice.userId, { dueDate: '2026-10-10', amountMinor: 100000 });
    await insertLoan(ctx, alice.userId, { dueDate: '2026-11-10', amountMinor: 50000 });
    await pay(overdue, alice, { amountMinor: 30000 });

    const s = (await get('/v1/summary', alice)).json();
    expect(s).toMatchObject({
      totalLentMinor: 150000,
      totalRepaidMinor: 30000,
      outstandingMinor: 120000,
      overdueMinor: 70000,
    });
    expect(s.counts).toMatchObject({ total: 2, outstanding: 2, overdue: 1, partial: 1, repaid: 0 });
  });
});
