import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Key for the HMAC that protects stored OTP codes. Must be long enough to be a real secret.
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters'),
  // The assignment mocks OTP delivery by printing the code to the server log.
  OTP_DELIVERY: z.enum(['console']).default('console'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  UPLOAD_DIR: z.string().default('./uploads'),
  // Coarse per-IP request limit (requests per minute). Per-phone OTP limits are enforced separately in the database.
  IP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
});

export type Config = z.infer<typeof envSchema>;

/** Parses and validates environment variables. Fails fast at boot with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${problems}\nSee apps/api/.env.example`);
  }
  const config = parsed.data;
  // Printing OTPs to the log is an assignment-only shortcut. Refuse to run it as a "production" server.
  if (config.NODE_ENV === 'production' && config.OTP_DELIVERY === 'console') {
    throw new Error('Refusing to start: OTP_DELIVERY=console (mock OTP) must not be used with NODE_ENV=production.');
  }
  return config;
}
