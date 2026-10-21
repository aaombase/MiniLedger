import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, closeTestDb, type TestContext } from '../test/helpers';
import { DEMO_PHONE, seedDemoData } from './seed';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await buildTestApp();
});

afterAll(closeTestDb);

async function loginAsDemoUser() {
  await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: DEMO_PHONE } });
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone: DEMO_PHONE, code: ctx.otp.lastCode(ctx.otp.sent[0]!.phone) },
  });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

describe('seedDemoData', () => {
  it('creates a demo ledger with every kind of loan, relative to today', async () => {
    await seedDemoData(ctx.db, ctx.clock);
    const headers = await loginAsDemoUser();

    const summary = (await ctx.app.inject({ method: 'GET', url: '/v1/summary', headers })).json();
    expect(summary).toMatchObject({
      asOf: '2026-10-21',
      totalLentMinor: 3_085_000,
      totalRepaidMinor: 1_270_000, // five settled loans plus two part-payments
      overdueMinor: 230_000, // only the unpaid part of an overdue loan counts
      counts: { total: 11, overdue: 2, dueSoon: 2, partial: 2, repaid: 5, outstanding: 6 },
    });
  });

  it('keeps every settled loan fully paid by its payment history', async () => {
    await seedDemoData(ctx.db, ctx.clock);
    const mismatched = await ctx.db.execute(sql`
      SELECT l.id FROM loans l
      LEFT JOIN (SELECT loan_id, SUM(amount_minor) AS paid FROM payments GROUP BY loan_id) p ON p.loan_id = l.id
      WHERE (l.repaid_at IS NOT NULL) <> (COALESCE(p.paid, 0) = l.amount_minor)`);
    expect(mismatched.rows).toEqual([]);
  });

  it('is idempotent: running it twice leaves exactly one copy of the data', async () => {
    await seedDemoData(ctx.db, ctx.clock);
    await seedDemoData(ctx.db, ctx.clock);
    const counts = (await ctx.db.execute(sql`select (select count(*)::int from users) as users, (select count(*)::int from loans) as loans, (select count(*)::int from payments) as payments`))
      .rows[0] as { users: number; loans: number; payments: number };
    expect(counts).toEqual({ users: 1, loans: 11, payments: 8 });
  });

  it('re-bases the dates on the day it runs, so the demo is never stale', async () => {
    await seedDemoData(ctx.db, ctx.clock);
    ctx.clock.set('2026-12-01T10:00:00Z');
    await seedDemoData(ctx.db, ctx.clock);
    const headers = await loginAsDemoUser();
    const summary = (await ctx.app.inject({ method: 'GET', url: '/v1/summary', headers })).json();
    expect(summary.asOf).toBe('2026-12-01');
    expect(summary.counts).toMatchObject({ overdue: 2, dueSoon: 2, repaid: 5 });
  });
});
