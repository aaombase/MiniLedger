import type { FastifyError, FastifyInstance } from 'fastify';

/** An expected, client-facing failure. Anything that is not an AppError is treated as a bug (500). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'),
  loanNotFound: () => new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found.'),
  loanAlreadyRepaid: () => new AppError(409, 'LOAN_ALREADY_REPAID', 'This loan has already been marked as repaid.'),
  otpExpired: () => new AppError(400, 'OTP_EXPIRED', 'This code is no longer valid. Please request a new one.'),
};

/** The one place that turns thrown errors into the `{ error: { code, message, details? } }` envelope. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | AppError, request, reply) => {
    if (err instanceof AppError) {
      if (err.headers) reply.headers(err.headers);
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }

    // Fastify's own 4xx errors: malformed JSON, unsupported content type, rate limit, etc.
    const status = (err as FastifyError).statusCode;
    if (status === 429) {
      return reply
        .status(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } });
    }
    if (status === 413) {
      return reply.status(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'That file is too large (max 5 MB).' } });
    }
    if (status === 415) {
      return reply
        .status(415)
        .send({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'That content type is not supported.' } });
    }
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: 'The request could not be understood.' } });
    }

    // Unexpected: log everything server-side, reveal nothing to the client.
    request.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
}
