import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { Config } from '../../config';
import type { Db } from '../../db/client';
import { otpChallenges, sessions, users } from '../../db/schema';
import type { Clock } from '../../lib/clock';
import { AppError, errors } from '../../lib/errors';
import type { OtpSender } from './otp-sender';

export const OTP_TTL_SECONDS = 300;
export const RESEND_COOLDOWN_SECONDS = 30;
export const MAX_OTP_REQUESTS_PER_HOUR = 5;
export const MAX_OTP_ATTEMPTS = 5;

const HOUR_MS = 3_600_000;

export interface AuthUser {
  id: string;
  phone: string;
  timezone: string;
}

export interface AuthServiceDeps {
  db: Db;
  clock: Clock;
  otpSender: OtpSender;
  config: Pick<Config, 'OTP_SECRET' | 'SESSION_TTL_DAYS'>;
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

function rateLimited(retryAfterSeconds: number): AppError {
  return new AppError(
    429,
    'OTP_RATE_LIMITED',
    'Please wait before requesting another code.',
    { retryAfterSeconds },
    { 'retry-after': String(retryAfterSeconds) },
  );
}

export function createAuthService({ db, clock, otpSender, config }: AuthServiceDeps) {
  // Bound to the phone so a code issued for one number can never validate against another.
  const hashCode = (phone: string, code: string): string =>
    createHmac('sha256', config.OTP_SECRET).update(`${phone}:${code}`).digest('hex');

  async function requestOtp(phone: string): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
    const now = clock.now();

    // Per-phone limits live in the database so they survive restarts and work across server instances.
    const recent = await db
      .select({ createdAt: otpChallenges.createdAt })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.phoneE164, phone), gt(otpChallenges.createdAt, new Date(now.getTime() - HOUR_MS))))
      .orderBy(desc(otpChallenges.createdAt));

    const latest = recent[0];
    if (latest) {
      const elapsed = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) throw rateLimited(Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
    }
    if (recent.length >= MAX_OTP_REQUESTS_PER_HOUR) {
      // A slot frees up when the oldest request in the window ages past one hour.
      const oldest = recent[MAX_OTP_REQUESTS_PER_HOUR - 1]!;
      throw rateLimited(Math.ceil((oldest.createdAt.getTime() + HOUR_MS - now.getTime()) / 1000));
    }

    // randomInt is a CSPRNG; Math.random must never be used for codes.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

    await db.transaction(async (tx) => {
      // Only the newest code is ever valid: retire any earlier ones for this phone.
      await tx
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(and(eq(otpChallenges.phoneE164, phone), isNull(otpChallenges.consumedAt)));
      await tx
        .insert(otpChallenges)
        .values({ phoneE164: phone, codeHash: hashCode(phone, code), expiresAt, createdAt: now });
    });

    await otpSender.send(phone, code, expiresAt);
    return { expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  async function verifyOtp(phone: string, code: string, timezone: string) {
    const now = clock.now();

    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(and(eq(otpChallenges.phoneE164, phone), isNull(otpChallenges.consumedAt)))
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);
    if (!challenge || challenge.expiresAt.getTime() <= now.getTime()) throw errors.otpExpired();

    // Count the guess *before* comparing, in one atomic statement: parallel guesses can't squeeze past the cap.
    const [counted] = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(
        and(
          eq(otpChallenges.id, challenge.id),
          isNull(otpChallenges.consumedAt),
          lt(otpChallenges.attempts, MAX_OTP_ATTEMPTS),
        ),
      )
      .returning({ attempts: otpChallenges.attempts });
    if (!counted) throw errors.otpExpired();

    const matches = timingSafeEqual(Buffer.from(challenge.codeHash, 'hex'), Buffer.from(hashCode(phone, code), 'hex'));
    if (!matches) {
      if (counted.attempts >= MAX_OTP_ATTEMPTS) {
        await db.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));
        throw new AppError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Please request a new code.');
      }
      throw new AppError(400, 'OTP_INVALID', "That code isn't right.", {
        attemptsRemaining: MAX_OTP_ATTEMPTS - counted.attempts,
      });
    }

    return db.transaction(async (tx) => {
      // Claim the challenge. If two requests present the right code at once, only one gets a row back.
      const claimed = await tx
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
        .returning({ id: otpChallenges.id });
      if (claimed.length === 0) throw errors.otpExpired();

      // First successful login creates the account.
      const [user] = await tx
        .insert(users)
        .values({ phoneE164: phone, timezone })
        .onConflictDoUpdate({ target: users.phoneE164, set: { timezone } })
        .returning();

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + config.SESSION_TTL_DAYS * 86_400_000);
      await tx
        .insert(sessions)
        .values({ userId: user!.id, tokenHash: hashToken(token), expiresAt, createdAt: now });

      return {
        token,
        expiresAt: expiresAt.toISOString(),
        user: { id: user!.id, phone: user!.phoneE164, timezone: user!.timezone },
      };
    });
  }

  async function authenticate(token: string): Promise<AuthUser | null> {
    const [row] = await db
      .select({ id: users.id, phone: users.phoneE164, timezone: users.timezone })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, clock.now())))
      .limit(1);
    return row ?? null;
  }

  async function logout(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  return { requestOtp, verifyOtp, authenticate, logout };
}

export type AuthService = ReturnType<typeof createAuthService>;
