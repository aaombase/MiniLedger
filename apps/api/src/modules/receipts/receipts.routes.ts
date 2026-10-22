import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/errors';
import { MAX_RECEIPT_BYTES, type ReceiptsService } from './receipts.service';

interface IdParams {
  id: string;
}
interface PaymentParams extends IdParams {
  paymentId: string;
}

const missingFile = (message: string) => new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { file: message });

function sendImage(reply: FastifyReply, data: Buffer, mime: string) {
  return reply
    .header('content-type', mime)
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'private, max-age=300')
    .send(data);
}

export function registerReceiptRoutes(
  app: FastifyInstance,
  receipts: ReceiptsService,
  authenticate: preHandlerAsyncHookHandler,
): void {
  app.register(async (scope) => {
    scope.addHook('preHandler', authenticate);

    scope.put<{ Params: IdParams }>('/v1/loans/:id/receipt', async (request) => {
      await receipts.assertOwned(request.user, request.params.id);

      if (!request.isMultipart()) throw missingFile('Send the photo as multipart/form-data in a field named "file"');
      // fileSize is enforced while streaming: an oversize upload is cut off, not buffered then checked.
      const part = await request.file({ limits: { fileSize: MAX_RECEIPT_BYTES } });
      if (!part || part.fieldname !== 'file') throw missingFile('Attach the photo in a field named "file"');

      const data = await part.toBuffer(); // throws 413 (FST_REQ_FILE_TOO_LARGE) past the limit
      return receipts.attach(request.user, request.params.id, data);
    });

    scope.delete<{ Params: IdParams }>('/v1/loans/:id/receipt', async (request) =>
      receipts.detach(request.user, request.params.id),
    );

    scope.get<{ Params: IdParams }>('/v1/loans/:id/receipt', async (request, reply) => {
      const { data, mime } = await receipts.read(request.user, request.params.id);
      return sendImage(reply, data, mime);
    });

    // A payment can carry its own proof, e.g. the UPI screenshot of that instalment.
    const paymentReceipt = '/v1/loans/:id/payments/:paymentId/receipt';

    scope.put<{ Params: PaymentParams }>(paymentReceipt, async (request) => {
      const { id, paymentId } = request.params;
      await receipts.assertPaymentOwned(request.user, id, paymentId);
      if (!request.isMultipart()) throw missingFile('Send the photo as multipart/form-data in a field named "file"');
      const part = await request.file({ limits: { fileSize: MAX_RECEIPT_BYTES } });
      if (!part || part.fieldname !== 'file') throw missingFile('Attach the photo in a field named "file"');
      return receipts.attachToPayment(request.user, id, paymentId, await part.toBuffer());
    });

    scope.delete<{ Params: PaymentParams }>(paymentReceipt, async (request) =>
      receipts.detachFromPayment(request.user, request.params.id, request.params.paymentId),
    );

    scope.get<{ Params: PaymentParams }>(paymentReceipt, async (request, reply) => {
      const { data, mime } = await receipts.readPaymentReceipt(request.user, request.params.id, request.params.paymentId);
      return sendImage(reply, data, mime);
    });
  });
}
