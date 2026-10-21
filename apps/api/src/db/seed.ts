import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TIMEZONE, addDays, normalizePhone, todayIn } from '@miniledger/shared';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from './client';
import { loans, payments, users } from './schema';
import { systemClock, type Clock } from '../lib/clock';

/** Log in as this number (the OTP appears in the server log) to see the demo ledger. */
export const DEMO_PHONE = '9000000001';

interface DemoPayment {
  rupees: number;
  daysAgo: number;
  note?: string;
}

interface DemoLoan {
  friendName: string;
  rupees: number;
  dueOffsetDays: number;
  createdDaysAgo: number;
  note?: string;
  payments?: DemoPayment[];
  /** Settled: the payments (or one payment of the full amount on this day) close the loan. */
  repaidDaysAgo?: number;
}

// Every kind of loan, dated relative to "today" so the demo never goes stale. Spread over ~6 months for the charts.
const DEMO_LOANS: DemoLoan[] = [
  { friendName: 'Rohan Mehta', rupees: 2500, dueOffsetDays: -12, createdDaysAgo: 40, payments: [{ rupees: 1000, daysAgo: 9, note: 'GPay' }] }, // overdue, part paid
  { friendName: 'Priya Sharma', rupees: 800, dueOffsetDays: -3, createdDaysAgo: 18 }, // overdue
  { friendName: 'Aman Gupta', rupees: 1200, dueOffsetDays: 0, createdDaysAgo: 14, note: 'Cab to airport' }, // due today
  { friendName: 'Neha Iyer', rupees: 4000, dueOffsetDays: 2, createdDaysAgo: 25, note: 'Concert tickets' }, // due soon
  { friendName: 'Kabir Singh', rupees: 650, dueOffsetDays: 21, createdDaysAgo: 6, note: 'Movie + dinner' }, // pending
  { friendName: 'Sara Khan', rupees: 15000, dueOffsetDays: 60, createdDaysAgo: 50, note: 'Laptop repair', payments: [{ rupees: 5000, daysAgo: 20, note: 'Cash' }] }, // pending, part paid
  { friendName: 'Rohan Mehta', rupees: 1800, dueOffsetDays: -70, createdDaysAgo: 120, repaidDaysAgo: 75, note: 'Goa trip share' }, // repaid
  { friendName: 'Ishaan Rao', rupees: 1500, dueOffsetDays: -10, createdDaysAgo: 45, payments: [{ rupees: 500, daysAgo: 30 }], repaidDaysAgo: 2 }, // repaid in parts
  { friendName: 'Meera Joshi', rupees: 300, dueOffsetDays: -20, createdDaysAgo: 35, repaidDaysAgo: 15 }, // repaid
  { friendName: 'Neha Iyer', rupees: 2200, dueOffsetDays: -95, createdDaysAgo: 150, repaidDaysAgo: 100, note: 'Phone EMI' }, // repaid
  { friendName: 'Kabir Singh', rupees: 900, dueOffsetDays: -130, createdDaysAgo: 170, repaidDaysAgo: 128 }, // repaid
];

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

/**
 * Replaces the demo user's loans with a fresh set dated relative to today. Safe to run repeatedly.
 * Writes through the same tables the API uses, so everything shown in the demo is real backend data.
 */
export async function seedDemoData(db: Db, clock: Clock = systemClock): Promise<void> {
  const phone = normalizePhone(DEMO_PHONE);
  if (!phone) throw new Error(`DEMO_PHONE ${DEMO_PHONE} is not a valid mobile number`);

  const now = clock.now();
  const today = todayIn(DEFAULT_TIMEZONE, now);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ phoneE164: phone, timezone: DEFAULT_TIMEZONE })
      .onConflictDoUpdate({ target: users.phoneE164, set: { timezone: DEFAULT_TIMEZONE } })
      .returning({ id: users.id });

    await tx.delete(loans).where(eq(loans.userId, user!.id)); // payments go with them (ON DELETE CASCADE)
    for (const l of DEMO_LOANS) {
      const repaidAt = l.repaidDaysAgo === undefined ? null : daysAgo(now, l.repaidDaysAgo);
      const [loan] = await tx
        .insert(loans)
        .values({
          userId: user!.id,
          friendName: l.friendName,
          amountMinor: l.rupees * 100,
          dueDate: addDays(today, l.dueOffsetDays),
          note: l.note ?? null,
          repaidAt,
          createdAt: daysAgo(now, l.createdDaysAgo),
          updatedAt: now,
        })
        .returning({ id: loans.id });

      const rows = (l.payments ?? []).map((p) => ({
        loanId: loan!.id,
        amountMinor: p.rupees * 100,
        paidOn: addDays(today, -p.daysAgo),
        note: p.note ?? null,
        createdAt: daysAgo(now, p.daysAgo),
      }));
      if (repaidAt) {
        // The settling payment covers whatever the earlier ones didn't.
        const paid = rows.reduce((sum, r) => sum + r.amountMinor, 0);
        rows.push({ loanId: loan!.id, amountMinor: l.rupees * 100 - paid, paidOn: addDays(today, -l.repaidDaysAgo!), note: null, createdAt: repaidAt });
      }
      if (rows.length) await tx.insert(payments).values(rows);
    }
  });
}

// Run directly: `npm run db:seed`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env first.');
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  seedDemoData(db)
    .then(() => console.log(`Demo data ready. Log in with phone ${DEMO_PHONE} (the OTP is printed in the API log).`))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
