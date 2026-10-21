import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
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

// Smallest byte sequences that really are each image type (the server identifies files by content, not by name).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(18)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
const TEXT = Buffer.from('this is definitely not an image');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

const MAX_BYTES = 5 * 1024 * 1024;

let ctx: TestContext;
let alice: LoggedInUser;
let bob: LoggedInUser;
let loanId: string;

beforeEach(async () => {
  ctx = await buildTestApp();
  alice = await loginAs(ctx, '98765 43210');
  bob = await loginAs(ctx, '98765 43211');
  loanId = await insertLoan(ctx, alice.userId, { dueDate: '2026-11-05' });
});

afterAll(closeTestDb);

const upload = (
  user: LoggedInUser | null,
  id: string,
  file: { filename?: string; contentType?: string; data: Buffer; field?: string },
) => {
  const { payload, headers } = multipartFile({
    filename: file.filename ?? 'receipt.jpg',
    contentType: file.contentType ?? 'image/jpeg',
    data: file.data,
    field: file.field,
  });
  return ctx.app.inject({
    method: 'PUT',
    url: `/v1/loans/${id}/receipt`,
    headers: { ...headers, ...user?.headers },
    payload,
  });
};

const download = (user: LoggedInUser | null, id: string) =>
  ctx.app.inject({ method: 'GET', url: `/v1/loans/${id}/receipt`, headers: user?.headers });

const filesOnDisk = () => readdir(ctx.uploadDir);

describe('PUT /v1/loans/:id/receipt', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
  ])('accepts a %s and marks the loan as having a receipt', async (_name, data, mime) => {
    const res = await upload(alice, loanId, { data, contentType: mime });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: loanId, hasReceipt: true });
    expect(await filesOnDisk()).toHaveLength(1);

    const row = (await ctx.db.execute(sql`select receipt_mime, receipt_bytes from loans where id = ${loanId}`)).rows[0] as {
      receipt_mime: string;
      receipt_bytes: number;
    };
    expect(row.receipt_mime).toBe(mime);
    expect(row.receipt_bytes).toBe(data.length);
  });

  it('identifies the file by its content, ignoring the declared type and file name', async () => {
    // A PDF dressed up as a JPEG.
    const res = await upload(alice, loanId, { data: PDF, filename: 'receipt.jpg', contentType: 'image/jpeg' });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await filesOnDisk()).toHaveLength(0);
  });

  it.each([
    ['plain text', TEXT],
    ['an SVG with a script', SVG],
  ])('rejects %s even when labelled image/png', async (_name, data) => {
    const res = await upload(alice, loanId, { data, filename: 'x.png', contentType: 'image/png' });
    expect(res.statusCode).toBe(415);
    expect(await filesOnDisk()).toHaveLength(0);
  });

  it('accepts a file right at the 5 MB limit', async () => {
    const data = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES - JPEG.length)]);
    const res = await upload(alice, loanId, { data });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a file over 5 MB and stores nothing', async () => {
    const data = Buffer.concat([JPEG, Buffer.alloc(MAX_BYTES + 1 - JPEG.length)]);
    const res = await upload(alice, loanId, { data });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await filesOnDisk()).toHaveLength(0);
    expect((await ctx.app.inject({ method: 'GET', url: `/v1/loans/${loanId}`, headers: alice.headers })).json().hasReceipt).toBe(false);
  });

  it('rejects an empty upload', async () => {
    const res = await upload(alice, loanId, { data: Buffer.alloc(0) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('requires the file in a field called "file"', async () => {
    const res = await upload(alice, loanId, { data: JPEG, field: 'photo' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details).toHaveProperty('file');
  });

  it('rejects a request that is not multipart', async () => {
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/loans/${loanId}/receipt`,
      headers: alice.headers,
      payload: { hello: 'world' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await upload(null, loanId, { data: JPEG });
    expect(res.statusCode).toBe(401);
    expect(await filesOnDisk()).toHaveLength(0);
  });

  it("cannot attach a receipt to another user's loan", async () => {
    const res = await upload(bob, loanId, { data: JPEG });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
    expect(await filesOnDisk()).toHaveLength(0);
    expect((await ctx.app.inject({ method: 'GET', url: `/v1/loans/${loanId}`, headers: alice.headers })).json().hasReceipt).toBe(false);
  });

  it('returns 404 for a malformed or unknown loan id', async () => {
    expect((await upload(alice, 'nope', { data: JPEG })).statusCode).toBe(404);
    expect((await upload(alice, '00000000-0000-4000-8000-000000000000', { data: JPEG })).statusCode).toBe(404);
  });

  it('never uses the client-supplied file name on disk (no path traversal)', async () => {
    const res = await upload(alice, loanId, { data: JPEG, filename: '../../../../evil.jpg' });
    expect(res.statusCode).toBe(200);
    const files = await filesOnDisk();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f-]{36}-[0-9a-f-]{36}\.jpg$/);
    expect(files[0]).toContain(loanId);
    expect(path.dirname(path.join(ctx.uploadDir, files[0]!))).toBe(ctx.uploadDir);
  });

  it('replaces an earlier receipt and deletes the old file', async () => {
    await upload(alice, loanId, { data: JPEG });
    const [firstFile] = await filesOnDisk();

    const res = await upload(alice, loanId, { data: PNG, contentType: 'image/png', filename: 'new.png' });
    expect(res.statusCode).toBe(200);

    const files = await filesOnDisk();
    expect(files).toHaveLength(1);
    expect(files[0]).not.toBe(firstFile);
    expect(files[0]).toMatch(/\.png$/);
    const served = await download(alice, loanId);
    expect(served.headers['content-type']).toBe('image/png');
    expect(Buffer.from(served.rawPayload).equals(PNG)).toBe(true);
  });
});

describe('GET /v1/loans/:id/receipt', () => {
  it('serves the stored bytes with the sniffed content type', async () => {
    await upload(alice, loanId, { data: JPEG });
    const res = await download(alice, loanId);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.from(res.rawPayload).equals(JPEG)).toBe(true);
  });

  it('sets headers that stop the browser guessing or sharing the file', async () => {
    await upload(alice, loanId, { data: JPEG });
    const res = await download(alice, loanId);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('private');
  });

  it('returns RECEIPT_NOT_FOUND when the loan has no receipt', async () => {
    const res = await download(alice, loanId);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it("does not serve another user's receipt", async () => {
    await upload(alice, loanId, { data: JPEG });
    const res = await download(bob, loanId);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('LOAN_NOT_FOUND');
  });

  it('requires authentication', async () => {
    await upload(alice, loanId, { data: JPEG });
    expect((await download(null, loanId)).statusCode).toBe(401);
  });

  it('returns RECEIPT_NOT_FOUND (not a 500) if the file has gone missing from disk', async () => {
    await upload(alice, loanId, { data: JPEG });
    const [file] = await filesOnDisk();
    const { rm } = await import('node:fs/promises');
    await rm(path.join(ctx.uploadDir, file!));
    const res = await download(alice, loanId);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('is not reachable as a static file', async () => {
    await upload(alice, loanId, { data: JPEG });
    const [file] = await filesOnDisk();
    for (const url of [`/uploads/${file}`, `/${file}`, `/static/${file}`]) {
      const res = await ctx.app.inject({ method: 'GET', url, headers: alice.headers });
      expect(res.statusCode).toBe(404);
    }
  });

  it('keeps the file readable from disk exactly as uploaded', async () => {
    await upload(alice, loanId, { data: PNG, contentType: 'image/png' });
    const [file] = await filesOnDisk();
    expect((await readFile(path.join(ctx.uploadDir, file!))).equals(PNG)).toBe(true);
  });
});
