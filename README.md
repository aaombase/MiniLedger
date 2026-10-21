# MiniLedger

**Your pocket khata.** A small app to track money you've lent to friends: who owes you, how much, by when, and what has come back.

- **Backend:** Node.js + TypeScript, Fastify 5, PostgreSQL (Drizzle ORM), zod validation
- **Mobile:** React Native + Expo (SDK 57, Expo Router), TanStack Query
- **Login:** phone number + one-time code (mock delivery: the code is printed in the server log)

## Features

**Core**
- Log in with a phone number and a 6-digit OTP
- Create a loan (friend's name, amount, due date, optional note)
- Mark a loan as repaid
- Summary: total lent, total repaid, outstanding and **overdue** amount
- Loan list with overdue loans clearly highlighted

**Beyond the brief**
- **Partial payments:** record any amount (back-dated if needed); a loan is settled once its payments add up to the full amount. Overdue counts only what's still unpaid.
- **Payment history** on every loan
- **Receipt photos:** attach a bill or UPI screenshot to a loan (camera or library)
- **Reminders:** one tap opens WhatsApp/SMS (system share sheet) with a polite, pre-written message
- **People:** balances grouped per friend, one reminder for all their open loans, "Lend again"
- **Insights:** % collected, on-time repayment rate, average days to settle, 6-month lent vs collected chart, who owes the most, how late overdue loans are
- **Activity feed** grouped by month, plus edit and delete for loans
- Search, filters (overdue / due soon / part-paid / upcoming / settled) and sorting

## Repository layout

```
apps/api         Fastify API, database schema, migrations, seed, tests
apps/mobile      Expo app (src/app = routes, src/screens, src/components, src/lib)
packages/shared  Money, date, status and validation rules shared by the API (with tests)
```

## Running it

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (local install, or `docker compose up -d db`)
- The **Expo Go** app (SDK 57) on an Android/iOS phone on the same Wi-Fi as your computer

### 1. Backend

```bash
npm install
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL and OTP_SECRET
npm run db:migrate
npm run db:seed                             # optional demo data (11 loans over 6 months)
cd apps/api && npx tsx src/server.ts        # listens on 0.0.0.0:4000
```

Check it: `curl http://localhost:4000/health` → `{"status":"ok","db":"ok"}`

### 2. Mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:4000   (not localhost: on the phone, localhost is the phone)
cd apps/mobile && npx expo start --lan
```

Scan the QR code with Expo Go. If the phone can't connect, open `http://<LAN IP>:4000/health` in the phone's browser; on Windows you may need to allow ports 4000 and 8081 through the firewall.

### 3. Logging in
Enter any Indian mobile number (the demo data belongs to **9000000001**). The OTP appears in the API log as:

```
[MOCK OTP] +91 90000 00001 -> 123456 (expires …, dev only)
```

The server refuses to start in production with console OTP delivery.

## API

All routes except auth and `/health` need `Authorization: Bearer <token>`. Errors share one shape: `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/auth/otp/request` | Send a code to `{ phone }` |
| POST | `/v1/auth/otp/verify` | `{ phone, code, timezone? }` → `{ token, user }` |
| POST | `/v1/auth/logout` | End the session |
| GET | `/v1/me` | Current user |
| GET | `/v1/loans?status=all\|outstanding\|overdue\|repaid` | List, most urgent first |
| POST | `/v1/loans` | `{ friendName, amountMinor, dueDate, note? }` |
| GET | `/v1/loans/:id` | Loan with payment history |
| PATCH | `/v1/loans/:id` | Edit `friendName`, `dueDate`, `note` |
| DELETE | `/v1/loans/:id` | Delete loan, its payments and receipt |
| POST | `/v1/loans/:id/payments` | `{ amountMinor, paidOn?, note? }`: partial payment |
| POST | `/v1/loans/:id/repay` | Settle whatever is still owed |
| PUT / GET / DELETE | `/v1/loans/:id/receipt` | Upload (multipart, ≤5 MB, JPEG/PNG/WebP) / fetch / remove receipt |
| GET | `/v1/summary` | Lent, repaid, outstanding, overdue + counts |
| GET | `/v1/activity?limit=` | Loans and payments, newest first |

## Design decisions

- **Money is integer paise** end to end (`amountMinor`), never floats.
- **Status is derived, never stored.** A loan is *overdue* when its due date is before "today", *due soon* within 3 days, and *repaid* when payments cover the amount. Due today is not overdue.
- **"Today" is the user's calendar day** (timezone captured at login, default Asia/Kolkata), computed per request by the server, not the phone.
- **Payments are concurrency-safe.** Each payment locks the loan row in a transaction, so simultaneous payments can never exceed the amount; a test proves it (and fails if the lock is removed).
- **Ownership is enforced in one place.** Another user's loan is indistinguishable from a missing one (404).
- **OTP security:** 6-digit CSPRNG codes stored only as HMACs, 5-minute expiry, 5 attempts, single use, 30 s resend cooldown and 5 requests/hour per phone.
- **Receipts:** file type checked from the bytes (not the declared type), size capped while streaming, server-generated file names, served only through the authenticated route.
- **The summary is one SQL statement**, so its figures always describe the same snapshot (a test checks it always agrees with the loan list).

## Tests

```bash
npm test          # shared rules + API integration tests against a real Postgres test database
npm run typecheck
```

249 tests: 102 for shared money/date/phone/validation rules and 147 API integration tests (auth, loans, partial payments, concurrency, summary, receipts, seed). API tests need a `miniledger_test` database (see `apps/api/src/test/env.ts`).

## Known limitations

- OTP delivery is mocked (console). A real SMS provider would implement the `OtpSender` interface.
- Receipts are stored on local disk; production would implement `ReceiptStorage` over object storage.
- Single currency (INR). A loan's amount can't be edited once created (delete and re-add instead) so payment history always adds up.
- `npm audit` reports moderate advisories in dev-only tooling (drizzle-kit's bundled esbuild); none ship in the app.
