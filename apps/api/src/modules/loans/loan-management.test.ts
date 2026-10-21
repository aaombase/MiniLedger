import { readdir } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestApp,
  closeTestDb,
  insertLoan,
  loginAs,
  multipartFile,
  type LoggedInUser,
  type TestContext,
} from '../../test/helpers';

let ctx: TestContext;
let alice: LoggedInUser;
let bob: LoggedInUser;

beforeEach(async () => {
  ctx = await buildTestApp(); // 2026-10-21 10:00 UTC
  alice = await loginAs(ctx, '98765 43210');
  bob = await loginAs(ctx, '98765 43211');
});

afterAll(closeTestDb);

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, user: LoggedInUser | null, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: user?.headers, payload: payload as object });

// Smallest valid PNG: enough for the server's magic-byte check.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

describe('PATCH /v1/loans/:id', () => {
  it('updates the friend name, due date and note', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', friendName: 'Rohn' });
    const res = await req('PATCH', `/v1/loans/${id}`, alice, {
      friendName: '  Rohan  Mehta ',
      dueDate: '2026-10-15',
      note: 'Fixed typo',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ friendName: 'Rohan Mehta', dueDate: '2026-10-15', note: 'Fixed typo', status: 'overdue' });
  });

  it('changes only the fields that are sent', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', friendName: 'Rohan', note: 'keep me' });
    const res = await req('PATCH', `/v1/loans/${id}`, alice, { dueDate: '2026-11-20' });
    expect(res.json()).toMatchObject({ friendName: 'Rohan', note: 'keep me', dueDate: '2026-11-20' });
  });

  it('ignores the amount and repayment fields', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 50000 });
    const res = await req('PATCH', `/v1/loans/${id}`, alice, { amountMinor: 1, repaidAt: '2026-10-01T00:00:00Z' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ amountMinor: 50000, repaidAt: null });
  });

  it('validates what it receives', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    for (const payload of [{ friendName: '   ' }, { dueDate: '2026-13-01' }, { note: 'x'.repeat(201) }]) {
      const res = await req('PATCH', `/v1/loans/${id}`, alice, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
  });

  it("cannot edit another user's loan", async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', friendName: 'Rohan' });
    expect((await req('PATCH', `/v1/loans/${id}`, bob, { friendName: 'Hacked' })).statusCode).toBe(404);
    expect((await req('GET', `/v1/loans/${id}`, alice)).json().friendName).toBe('Rohan');
  });
});

describe('DELETE /v1/loans/:id', () => {
  it('deletes the loan with its payments and receipt file', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01', amountMinor: 100000 });
    await req('POST', `/v1/loans/${id}/payments`, alice, { amountMinor: 1000 });
    const upload = multipartFile({ filename: 'r.png', contentType: 'image/png', data: PNG });
    const put = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/loans/${id}/receipt`,
      headers: { ...alice.headers, ...upload.headers },
      payload: upload.payload,
    });
    expect(put.statusCode).toBe(200);
    expect(await readdir(ctx.uploadDir)).toHaveLength(1);

    const res = await req('DELETE', `/v1/loans/${id}`, alice);
    expect(res.statusCode).toBe(204);
    expect((await req('GET', `/v1/loans/${id}`, alice)).statusCode).toBe(404);
    const left = await ctx.db.execute(sql`SELECT count(*)::int AS n FROM payments WHERE loan_id = ${id}`);
    expect(Number((left.rows[0] as { n: number }).n)).toBe(0);
    expect(await readdir(ctx.uploadDir)).toHaveLength(0);
  });

  it("cannot delete another user's loan", async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    expect((await req('DELETE', `/v1/loans/${id}`, bob)).statusCode).toBe(404);
    expect((await req('GET', `/v1/loans/${id}`, alice)).statusCode).toBe(200);
  });

  it('requires authentication', async () => {
    const id = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    expect((await req('DELETE', `/v1/loans/${id}`, null)).statusCode).toBe(401);
  });
});

describe('GET /v1/activity', () => {
  it('lists loan and payment events newest first, scoped to the caller', async () => {
    const res1 = await req('POST', '/v1/loans', alice, { friendName: 'Rohan', amountMinor: 100000, dueDate: '2026-11-05' });
    const loanId = res1.json().id;
    ctx.clock.advanceSeconds(60);
    await req('POST', `/v1/loans/${loanId}/payments`, alice, { amountMinor: 40000 });
    ctx.clock.advanceSeconds(60);
    await req('POST', `/v1/loans/${loanId}/repay`, alice);
    await req('POST', '/v1/loans', bob, { friendName: 'Not mine', amountMinor: 5000, dueDate: '2026-11-05' });

    const res = await req('GET', '/v1/activity', alice);
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([
      expect.objectContaining({ type: 'payment', loanId, friendName: 'Rohan', amountMinor: 60000, settled: true, date: '2026-10-21' }),
      expect.objectContaining({ type: 'payment', loanId, amountMinor: 40000, settled: false }),
      expect.objectContaining({ type: 'loan_created', loanId, amountMinor: 100000, date: '2026-10-21' }),
    ]);
  });

  it('honours the limit', async () => {
    for (let i = 0; i < 3; i++) await insertLoan(ctx, alice.userId, { dueDate: '2026-11-01' });
    expect((await req('GET', '/v1/activity?limit=2', alice)).json().items).toHaveLength(2);
    expect((await req('GET', '/v1/activity?limit=0', alice)).statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await req('GET', '/v1/activity', null)).statusCode).toBe(401);
  });
});
