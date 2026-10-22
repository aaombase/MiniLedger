import { readdir } from 'node:fs/promises';
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

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const TEXT = Buffer.from('this is definitely not an image');

let ctx: TestContext;
let alice: LoggedInUser;
let bob: LoggedInUser;
let loanId: string;
let paymentId: string;

beforeEach(async () => {
  ctx = await buildTestApp();
  alice = await loginAs(ctx, '98765 43210');
  bob = await loginAs(ctx, '98765 43211');
  loanId = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-05', amountMinor: 100000 });
  const res = await ctx.app.inject({ method: 'POST', url: `/v1/loans/${loanId}/payments`, headers: alice.headers, payload: { amountMinor: 30000 } });
  expect(res.statusCode).toBe(201);
  paymentId = res.json().payments[0].id;
});

afterAll(closeTestDb);

const url = (l = loanId, p = paymentId) => `/v1/loans/${l}/payments/${p}/receipt`;
const upload = (user: LoggedInUser | null, data: Buffer, target = url()) => {
  const { payload, headers } = multipartFile({ filename: 'proof.jpg', contentType: 'image/jpeg', data });
  return ctx.app.inject({ method: 'PUT', url: target, headers: { ...headers, ...user?.headers }, payload });
};
const loan = async () => (await ctx.app.inject({ method: 'GET', url: `/v1/loans/${loanId}`, headers: alice.headers })).json();

describe('payment receipts', () => {
  it('starts without a receipt', async () => {
    expect((await loan()).payments[0].hasReceipt).toBe(false);
    const res = await ctx.app.inject({ method: 'GET', url: url(), headers: alice.headers });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('attaches a photo to a payment and serves it back', async () => {
    const res = await upload(alice, JPEG);
    expect(res.statusCode).toBe(200);
    expect(res.json().payments[0]).toMatchObject({ id: paymentId, hasReceipt: true });
    expect(res.json().hasReceipt).toBe(false); // the loan's own receipt is separate

    const got = await ctx.app.inject({ method: 'GET', url: url(), headers: alice.headers });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(got.rawPayload).equals(JPEG)).toBe(true);
    expect(await readdir(ctx.uploadDir)).toHaveLength(1);
  });

  it('replaces a photo without leaving the old file behind', async () => {
    await upload(alice, JPEG);
    await upload(alice, Buffer.concat([JPEG, Buffer.from([0])]));
    expect(await readdir(ctx.uploadDir)).toHaveLength(1);
  });

  it('removes a photo and its file', async () => {
    await upload(alice, JPEG);
    const res = await ctx.app.inject({ method: 'DELETE', url: url(), headers: alice.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().payments[0].hasReceipt).toBe(false);
    expect(await readdir(ctx.uploadDir)).toHaveLength(0);
  });

  it('returns 404 when removing a photo that is not there', async () => {
    const res = await ctx.app.inject({ method: 'DELETE', url: url(), headers: alice.headers });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('rejects files that are not images', async () => {
    const res = await upload(alice, TEXT);
    expect(res.statusCode).toBe(415);
    expect((await loan()).payments[0].hasReceipt).toBe(false);
  });

  it("cannot touch another user's payment photo", async () => {
    await upload(alice, JPEG);
    expect((await upload(bob, JPEG)).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: url(), headers: bob.headers })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'DELETE', url: url(), headers: bob.headers })).statusCode).toBe(404);
    expect(await readdir(ctx.uploadDir)).toHaveLength(1);
  });

  it('does not accept a payment id that belongs to a different loan', async () => {
    const other = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-05' });
    expect((await upload(alice, JPEG, url(other, paymentId))).statusCode).toBe(404);
    expect(await readdir(ctx.uploadDir)).toHaveLength(0);
  });

  it('returns 404 for malformed ids', async () => {
    expect((await upload(alice, JPEG, url(loanId, 'nope'))).statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    expect((await upload(null, JPEG)).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'GET', url: url() })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'DELETE', url: url() })).statusCode).toBe(401);
  });

  it('deletes payment photos when the loan is deleted', async () => {
    await upload(alice, JPEG);
    expect(await readdir(ctx.uploadDir)).toHaveLength(1);
    const res = await ctx.app.inject({ method: 'DELETE', url: `/v1/loans/${loanId}`, headers: alice.headers });
    expect(res.statusCode).toBe(204);
    expect(await readdir(ctx.uploadDir)).toHaveLength(0);
  });
});
