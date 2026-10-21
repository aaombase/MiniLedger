import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/errors';
import { MAX_RECEIPT_BYTES, type ReceiptsService } from './receipts.service';

interface IdParams {
  id: string;
}

const missingFile = (message: string) => new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { file: message });

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

    scope.get<{ Params: IdParams }>('/v1/loans/:id/receipt', async (request, reply) => {
      const { data, mime } = await receipts.read(request.user, request.params.id);
      return reply
        .header('content-type', mime)
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', 'private, max-age=300')
        .send(data);
    });
  });
}
