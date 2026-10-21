import { zodIssuesToDetails } from '@miniledger/shared';
import type { ZodType, z } from 'zod';
import { AppError } from './errors';

/** Parses untrusted input with a shared zod schema; failures become a 400 with per-field messages. */
export function parseInput<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', zodIssuesToDetails(result.error));
  }
  return result.data;
}
