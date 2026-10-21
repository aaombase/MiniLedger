import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestApp,
  closeTestDb,
  insertLoan,
  loginAs,
  type LoggedInUser,
  type TestContext,
} from '../../test/helpers';

let ctx: TestContext;
let alice: LoggedInUser;
let bob: LoggedInUser;

beforeEach(async () => {
  ctx = await buildTestApp(); // 2026-10-21 10:00 UTC; today is 2026-10-21 in Kolkata
  alice = await loginAs(ctx, '98765 43210');
  bob = await loginAs(ctx, '98765 43211');
});

afterAll(closeTestDb);

const summary = (user: LoggedInUser) => ctx.app.inject({ method: 'GET', url: '/v1/summary', headers: user.headers });
const list = (user: LoggedInUser) => ctx.app.inject({ method: 'GET', url: '/v1/loans', headers: user.headers });

async function seedMixedLedger(userId: string) {
  const ids = {
    overdueOld: await insertLoan(ctx, userId, { amountMinor: 250000, dueDate: '2026-10-09' }),
    overdueNew: await insertLoan(ctx, userId, { amountMinor: 80000, dueDate: '2026-10-18' }),
    dueToday: await insertLoan(ctx, userId, { amountMinor: 120000, dueDate: '2026-10-21' }),
    dueSoon: await insertLoan(ctx, userId, { amountMinor: 400000, dueDate: '2026-10-23' }),
    pendingNear: await insertLoan(ctx, userId, { amountMinor: 65000, dueDate: '2026-11-11' }),
    pendingFar: await insertLoan(ctx, userId, { amountMinor: 1500000, dueDate: '2026-12-20' }),
    repaidA: await insertLoan(ctx, userId, { amountMinor: 150000, dueDate: '2026-10-11', repaidAt: '2026-10-19T08:00:00Z' }),
    repaidB: await insertLoan(ctx, userId, { amountMinor: 30000, dueDate: '2026-10-01', repaidAt: '2026-10-06T08:00:00Z' }),
  };
  return ids;
}

describe('GET /v1/summary', () => {
  it('returns zeros (not null) for a user with no loans', async () => {
    const res = await summary(alice);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      asOf: '2026-10-21',
      currency: 'INR',
      totalLentMinor: 0,
      totalRepaidMinor: 0,
      outstandingMinor: 0,
      overdueMinor: 0,
      counts: { total: 0, outstanding: 0, overdue: 0, dueSoon: 0, partial: 0, repaid: 0 },
    });
  });

  it('computes exact totals for a mixed ledger', async () => {
    await seedMixedLedger(alice.userId);
    expect((await summary(alice)).json()).toEqual({
      asOf: '2026-10-21',
      currency: 'INR',
      totalLentMinor: 2_595_000,
      totalRepaidMinor: 180_000,
      outstandingMinor: 2_415_000,
      overdueMinor: 330_000,
      counts: { total: 8, outstanding: 6, overdue: 2, dueSoon: 2, partial: 0, repaid: 2 },
    });
  });

  it('keeps the accounting identities: lent = repaid + outstanding, overdue <= outstanding', async () => {
    await seedMixedLedger(alice.userId);
    const s = (await summary(alice)).json();
    expect(s.totalLentMinor).toBe(s.totalRepaidMinor + s.outstandingMinor);
    expect(s.overdueMinor).toBeLessThanOrEqual(s.outstandingMinor);
    expect(s.counts.total).toBe(s.counts.outstanding + s.counts.repaid);
  });

  it('always agrees with the loan list (summary and list can never disagree)', async () => {
    const ids = await seedMixedLedger(alice.userId);
    // Part-payments on an overdue and an upcoming loan, so paid/remaining differ from the face amounts.
    for (const [id, amountMinor] of [[ids.overdueOld, 100000], [ids.pendingFar, 250000]] as const) {
      const r = await ctx.app.inject({ method: 'POST', url: `/v1/loans/${id}/payments`, headers: alice.headers, payload: { amountMinor } });
      expect(r.statusCode).toBe(201);
    }
    const s = (await summary(alice)).json();
    const l = (await list(alice)).json();
    const loans = l.loans as { amountMinor: number; paidMinor: number; remainingMinor: number; status: string }[];
    const open = ['overdue', 'due_soon', 'pending'];
    const pick = (status?: string[]) => loans.filter((x) => !status || status.includes(x.status));
    const total = (xs: typeof loans, key: 'amountMinor' | 'paidMinor' | 'remainingMinor') =>
      xs.reduce((acc, x) => acc + x[key], 0);

    expect(s.asOf).toBe(l.asOf);
    expect(s.totalLentMinor).toBe(total(pick(), 'amountMinor'));
    expect(s.totalRepaidMinor).toBe(total(pick(), 'paidMinor'));
    expect(s.overdueMinor).toBe(total(pick(['overdue']), 'remainingMinor'));
    expect(s.outstandingMinor).toBe(total(pick(open), 'remainingMinor'));
    expect(s.counts).toEqual({
      total: loans.length,
      outstanding: pick(open).length,
      overdue: pick(['overdue']).length,
      dueSoon: pick(['due_soon']).length,
      partial: pick(open).filter((x) => x.paidMinor > 0).length,
      repaid: pick(['repaid']).length,
    });
  });

  it("excludes other users' loans", async () => {
    await seedMixedLedger(alice.userId);
    await insertLoan(ctx, bob.userId, { amountMinor: 999900, dueDate: '2026-10-01' });
    const b = (await summary(bob)).json();
    expect(b.totalLentMinor).toBe(999_900);
    expect(b.overdueMinor).toBe(999_900);
    expect(b.counts.total).toBe(1);
    expect((await summary(alice)).json().totalLentMinor).toBe(2_595_000);
  });

  it('moves a repaid overdue loan from overdue into repaid', async () => {
    const ids = await seedMixedLedger(alice.userId);
    const res = await ctx.app.inject({ method: 'POST', url: `/v1/loans/${ids.overdueOld}/repay`, headers: alice.headers });
    expect(res.statusCode).toBe(200);
    const s = (await summary(alice)).json();
    expect(s.totalLentMinor).toBe(2_595_000); // lent never changes on repayment
    expect(s.totalRepaidMinor).toBe(180_000 + 250_000);
    expect(s.overdueMinor).toBe(330_000 - 250_000);
    expect(s.outstandingMinor).toBe(2_415_000 - 250_000);
    expect(s.counts).toMatchObject({ overdue: 1, repaid: 3, outstanding: 5 });
  });

  it('reflects a newly created loan immediately', async () => {
    await seedMixedLedger(alice.userId);
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/v1/loans',
      headers: alice.headers,
      payload: { friendName: 'Dev', amountMinor: 100000, dueDate: '2026-10-17' }, // past -> overdue
    });
    expect(created.statusCode).toBe(201);
    const s = (await summary(alice)).json();
    expect(s.totalLentMinor).toBe(2_595_000 + 100_000);
    expect(s.overdueMinor).toBe(330_000 + 100_000);
    expect(s.outstandingMinor).toBe(2_415_000 + 100_000);
    expect(s.counts).toMatchObject({ total: 9, overdue: 3 });
  });

  it('does not count a loan due today as overdue', async () => {
    await insertLoan(ctx, alice.userId, { amountMinor: 500000, dueDate: '2026-10-21' });
    const s = (await summary(alice)).json();
    expect(s.overdueMinor).toBe(0);
    expect(s.counts).toMatchObject({ overdue: 0, dueSoon: 1 });
  });

  it("uses each user's timezone for what counts as overdue", async () => {
    ctx.clock.set('2026-10-21T18:45:00Z'); // 22 Oct 00:15 in Kolkata, 21 Oct 14:45 in New York
    const kolkata = await loginAs(ctx, '98765 43212', 'Asia/Kolkata');
    const newYork = await loginAs(ctx, '+1 415 555 2671', 'America/New_York');
    ctx.clock.set('2026-10-21T18:45:00Z');
    await insertLoan(ctx, kolkata.userId, { amountMinor: 700000, dueDate: '2026-10-21' });
    await insertLoan(ctx, newYork.userId, { amountMinor: 700000, dueDate: '2026-10-21' });

    expect((await summary(kolkata)).json()).toMatchObject({ asOf: '2026-10-22', overdueMinor: 700_000 });
    expect((await summary(newYork)).json()).toMatchObject({ asOf: '2026-10-21', overdueMinor: 0 });
  });

  it('returns whole numbers, never strings or floats', async () => {
    await seedMixedLedger(alice.userId);
    const s = (await summary(alice)).json();
    for (const key of ['totalLentMinor', 'totalRepaidMinor', 'outstandingMinor', 'overdueMinor']) {
      expect(Number.isInteger(s[key])).toBe(true);
    }
    for (const value of Object.values(s.counts)) expect(Number.isInteger(value)).toBe(true);
  });
});
