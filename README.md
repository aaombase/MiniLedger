# MiniLedger

**Your pocket khata.** A small app to track money you've lent to friends: who owes you, how much, by when, and what has come back.

- **Backend:** Node.js + TypeScript, Fastify 5, PostgreSQL (Drizzle ORM), zod validation
- **Mobile:** React Native + Expo (SDK 57, Expo Router), TanStack Query
- **Login:** phone number + one-time code. The code is **not sent by SMS**: it is printed in the API server's terminal (mock delivery, as the assignment allows).

**Contents:** [Features](#features) · [Quick start](#quick-start-checklist) · [Setup](#full-setup-step-by-step) · [Testing the app](#testing-the-app-on-a-phone) · [API by hand](#trying-the-api-without-the-app) · [Automated tests](#automated-tests) · [Troubleshooting](#troubleshooting) · [Design](#design-decisions)

---

## Features

**Core (from the brief)**
- Log in with a phone number and a 6-digit OTP
- Create a loan (friend's name, amount, due date, optional note)
- Mark a loan as repaid
- Summary: total lent, total repaid, outstanding and **overdue** amount
- Loan list with overdue loans clearly highlighted

**Beyond the brief**
- **Partial payments:** record any amount (back-dated if needed); a loan is settled once its payments add up to the full amount. Overdue counts only what's still unpaid.
- **Payment history** on every loan
- **Receipt photos:** attach a bill / UPI screenshot to a loan, **while adding it or later**; view, replace or remove it (camera or gallery)
- **Proof of each payment:** every repayment can carry its own photo (e.g. the UPI screenshot of that instalment), added while recording the payment or afterwards
- **Reminders:** one tap opens WhatsApp/SMS (system share sheet) with a polite, pre-written message
- **People:** balances grouped per friend (someone can borrow many times), one reminder for all their open loans, "Lend again"
- **Insights:** % collected, on-time repayment rate, average days to settle, 6-month lent vs collected chart, who owes the most, how late overdue loans are
- **Activity feed** grouped by month, plus edit and delete for loans
- Search, filters (overdue / due soon / part-paid / upcoming / settled) and sorting

## Repository layout

```
apps/api         Fastify API: database schema, migrations, demo seed, tests
apps/mobile      Expo app (src/app = routes, src/screens, src/components, src/lib)
packages/shared  Money, date, status and validation rules used by the API (with tests)
```

---

## Quick start checklist

For people who already have Node and Postgres. Every step is explained in [Full setup](#full-setup-step-by-step).

```bash
git clone https://github.com/aaombase/MiniLedger.git && cd MiniLedger
npm install
docker compose up -d db                                   # or use your own Postgres (see step 2)
docker compose exec db createdb -U miniledger miniledger_test
cp apps/api/.env.example apps/api/.env                    # then set OTP_SECRET
cp apps/mobile/.env.example apps/mobile/.env              # then set your computer's LAN IP
npm run db:migrate
npm run db:seed                                           # demo data for phone 9000000001
npm run dev:api                                           # terminal 1: API on port 4000
npm run dev:mobile                                        # terminal 2: scan the QR with Expo Go
```

---

## Full setup, step by step

### 1. What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or newer (developed on 24) | includes `npm` |
| PostgreSQL | 13 or newer | your own install, **or** Docker Desktop to run the bundled one |
| Git | any | |
| A phone | Android or iPhone | with **Expo Go** installed from the Play Store / App Store |

The phone and the computer must be on the **same Wi-Fi network**.

> The app is built for **Expo SDK 57**. Expo Go shows the SDK it supports in its settings. If Expo Go says *"Project is incompatible with this version of Expo Go"*, see [Troubleshooting](#troubleshooting).

### 2. Get the code and install dependencies

```bash
git clone https://github.com/aaombase/MiniLedger.git
cd MiniLedger
npm install
```

One `npm install` at the root installs all three packages (it's an npm workspaces monorepo). The included `.npmrc` sets `legacy-peer-deps`, which Expo's React Native packages need; you don't have to pass any flags.

### 3. Create the databases

You need two databases: `miniledger` (the app) and `miniledger_test` (wiped and reused by the automated tests). Pick **one** option.

**Option A: Docker (easiest)**

```bash
docker compose up -d db
docker compose exec db createdb -U miniledger miniledger_test
```

This starts Postgres 16 on `localhost:5432` with user `miniledger`, password `miniledger_dev`, and creates the `miniledger` database.

**Option B: your own Postgres**

Open `psql` as a superuser (e.g. `psql -U postgres`) and run:

```sql
CREATE ROLE miniledger LOGIN PASSWORD 'miniledger_dev';
CREATE DATABASE miniledger OWNER miniledger;
CREATE DATABASE miniledger_test OWNER miniledger;
```

If you use different credentials, change the URLs in the next step to match.

### 4. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Then open `apps/api/.env`:

| Variable | What to set |
|---|---|
| `DATABASE_URL` | Leave as is if you used the credentials above. |
| `TEST_DATABASE_URL` | Same, pointing at `miniledger_test`. |
| `OTP_SECRET` | **Change it.** Any random string of 32+ characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` / `HOST` | Keep `4000` and `0.0.0.0` (`0.0.0.0` lets your phone reach the server). |
| everything else | Defaults are fine. |

### 5. Create the tables and load demo data

```bash
npm run db:migrate     # creates all tables
npm run db:seed        # optional but recommended
```

The seed creates a demo account for phone number **9000000001** with 11 loans spread over the last 6 months: overdue, due today, due soon, upcoming, part-paid and settled, including friends who borrowed more than once. Dates are relative to today, so the demo never goes stale. Running it again resets that account's loans.

### 6. Start the API

```bash
npm run dev:api
```

You should see `MiniLedger API ready…`. Keep this terminal open: **login codes appear here.**

Check it works (in another terminal or a browser): `http://localhost:4000/health` should return `{"status":"ok","db":"ok"}`.

### 7. Point the app at your computer

The phone needs your computer's address on the Wi-Fi network (`localhost` won't work: on a phone, localhost is the phone itself).

Find your computer's LAN IPv4 address:
- **Windows:** run `ipconfig`, look for **IPv4 Address** under your Wi-Fi adapter (e.g. `192.168.1.20`)
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
```

Now, **on the phone's browser**, open `http://<that IP>:4000/health`. If you see `{"status":"ok","db":"ok"}`, the phone can reach the server. If not, see [Troubleshooting](#troubleshooting) before going further.

> If your Wi-Fi changes, the IP changes too: update this file and restart step 8.

### 8. Start the app

In a second terminal:

```bash
npm run dev:mobile
```

A QR code appears (first start takes a minute while it builds).
- **Android:** open Expo Go → *Scan QR code*.
- **iPhone:** scan with the Camera app; it opens in Expo Go.
- No QR code? In Expo Go choose *Enter URL manually* and type `exp://<your IP>:8081`.

---

## Testing the app on a phone

### Logging in

1. Enter **9000000001** (the demo account) or any valid Indian mobile number (a new number starts with an empty ledger).
2. Tap *Send code*.
3. In the **API terminal** (step 6) find a line like:
   ```
   [MOCK OTP] +91 90000 00001 -> 482913 (expires …, dev only)
   ```
4. Type those 6 digits into the app.

Codes expire after 5 minutes and allow 5 attempts. You can request a new one after 30 seconds (max 5 per hour per number).

### What to try

A suggested walkthrough that covers every feature:

| # | Where | Try this | Expect |
|---|---|---|---|
| 1 | Home | Look at the green card | Amount owed (counts up), % collected, Lent / Collected / **Overdue** tiles |
| 2 | Home | "Needs attention" | Overdue and due-soon loans with a reminder link |
| 3 | Khata tab | Scroll the list | Overdue loans tinted red with an **OVERDUE** stamp; part-paid loans show a progress bar |
| 4 | Khata tab | Type a name in search, tap filter chips, tap the sort pill | List narrows; search box stays visible above the keyboard |
| 5 | Centre **+** | Add a loan (name, amount, due date via the quick chips) | Saved; appears in the list and the totals change |
| 6 | Add loan | Try ₹0, ₹20,00,000, 3 decimals, an empty name | Clear inline error messages; Save stays disabled |
| 7 | Loan detail | *Record payment* → enter part of the amount | Progress bar moves; payment appears in history; loan stays open |
| 8 | Record payment | Enter more than is owed | Error: "… only owes ₹X" |
| 9 | Loan detail | *Settle in full* | Records the remainder; big **PAID IN FULL** stamp |
| 10 | Add loan, Loan detail | Attach a receipt photo while adding a loan, or later under *Receipt* (camera or gallery) | Photo shows; tap to view full screen; *Replace* / *Remove* work |
| 10b | Record payment, Loan detail | Add *Proof of payment* when recording a payment, or tap *Add proof* next to a payment in the history | Thumbnail beside that payment; tap to view, replace or remove |
| 11 | Loan detail | *Remind* | Share sheet opens with a ready-made message (WhatsApp, SMS…) |
| 12 | Loan detail | ⋯ menu → *Edit details* / *Delete loan* | Name, due date and note editable; delete asks for confirmation |
| 13 | People tab | Tap a friend with 2 loans (e.g. Rohan Mehta) | Their total owed, both loans, *Remind* (one message for all) and *Lend again* |
| 14 | Insights tab | Look around | Collection donut, on-time %, 6-month chart, top borrowers, overdue ageing |
| 15 | Home | *Activity* | Every loan and payment grouped by month |
| 16 | Home | Profile icon (top right) → *Log out* | Back to login; logging in again shows the same data |

Pull down on Home, Khata, People or Insights to refresh.

---

## Trying the API without the app

All routes except login and `/health` need `Authorization: Bearer <token>`. Amounts are in **paise** (₹1 = 100). Examples use `curl` against `localhost:4000`.

```bash
# 1. Ask for a code (it appears in the API terminal)
curl -X POST localhost:4000/v1/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"9000000001"}'

# 2. Exchange it for a token
curl -X POST localhost:4000/v1/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"phone":"9000000001","code":"123456"}'
# → {"token":"…","user":{…}}   then:
TOKEN=paste-the-token-here

# 3. Use it
curl localhost:4000/v1/summary -H "Authorization: Bearer $TOKEN"
curl "localhost:4000/v1/loans?status=overdue" -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:4000/v1/loans -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"friendName":"Rohan","amountMinor":150000,"dueDate":"2026-12-31","note":"Concert"}'
curl -X POST localhost:4000/v1/loans/<id>/payments -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amountMinor":50000}'
curl -X POST localhost:4000/v1/loans/<id>/repay -H "Authorization: Bearer $TOKEN"
curl -X PUT localhost:4000/v1/loans/<id>/receipt -H "Authorization: Bearer $TOKEN" -F "file=@receipt.jpg"
```

(On Windows PowerShell use `curl.exe` and escape the JSON quotes, or use Git Bash.)

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Server and database status |
| POST | `/v1/auth/otp/request` | Send a code to `{ phone }` |
| POST | `/v1/auth/otp/verify` | `{ phone, code, timezone? }` → `{ token, expiresAt, user }` |
| POST | `/v1/auth/logout` | End the session |
| GET | `/v1/me` | Current user |
| GET | `/v1/loans?status=all\|outstanding\|overdue\|repaid` | List, most urgent first |
| POST | `/v1/loans` | `{ friendName, amountMinor, dueDate, note? }` |
| GET | `/v1/loans/:id` | Loan with payment history |
| PATCH | `/v1/loans/:id` | Edit `friendName`, `dueDate`, `note` |
| DELETE | `/v1/loans/:id` | Delete loan, its payments and receipt |
| POST | `/v1/loans/:id/payments` | `{ amountMinor, paidOn?, note? }`: partial payment |
| POST | `/v1/loans/:id/repay` | Settle whatever is still owed |
| PUT / GET / DELETE | `/v1/loans/:id/receipt` | Upload (multipart field `file`, ≤5 MB, JPEG/PNG/WebP) / fetch / remove the loan's receipt |
| PUT / GET / DELETE | `/v1/loans/:id/payments/:paymentId/receipt` | Same, for the proof of one payment |
| GET | `/v1/summary` | Lent, repaid, outstanding, overdue, plus counts |
| GET | `/v1/activity?limit=` | Loans and payments, newest first |

Errors always look like `{ "error": { "code": "LOAN_NOT_FOUND", "message": "…", "details": { … } } }`, with status codes 400 (validation), 401 (not logged in), 404 (not found, including other users' loans), 409 (already repaid), 413/415 (bad upload), 422 (payment larger than balance), 429 (rate limited).

---

## Automated tests

Needs the test database from step 3 (`TEST_DATABASE_URL` in `apps/api/.env`). The API itself does not need to be running.

```bash
npm test            # 260 tests: shared rules + API integration tests against real Postgres
npm run typecheck   # TypeScript checks for shared, api and mobile
```

- **102 shared tests:** money parsing and formatting, dates and time zones, loan status, phone numbers, validation
- **158 API tests:** login and OTP limits, loans, partial payments, concurrency (simultaneous payments can't overpay), summary maths, receipts (loan and payment photos), seed

Run one part only with `npm run test:shared` or `npm run test:api`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Project is incompatible with this version of Expo Go"** | The app targets Expo SDK 57 and Expo Go only runs the SDK it was built for. Check the SDK in Expo Go's settings. If it differs, either install an Expo Go build for SDK 57, or build the app directly onto an Android phone with `cd apps/mobile && npx expo run:android` (needs Android Studio and USB debugging). |
| **"Couldn't reach MiniLedger"** in the app | The phone can't reach the API. Open `http://<IP>:4000/health` in the phone's browser. If it fails: same Wi-Fi? correct IP in `apps/mobile/.env`? API running? Then check the firewall (next row). Restart `npm run dev:mobile` after editing `.env`. |
| Phone can't connect at all (Windows) | Allow the ports through Windows Firewall. In an **admin** PowerShell: `New-NetFirewallRule -DisplayName "MiniLedger dev" -Direction Inbound -Protocol TCP -LocalPort 4000,8081 -Action Allow -Profile Private`, and make sure your Wi-Fi is set to a *Private* network. Hotel / office / phone-hotspot networks may block devices from talking to each other; try a home network. |
| No QR code / Expo Go stuck loading | Wait for the first bundle (a minute). Or type `exp://<IP>:8081` in Expo Go. As a last resort, `cd apps/mobile && npx expo start --tunnel` (slower, works across networks; the API URL must still be reachable). |
| `Invalid configuration: OTP_SECRET…` | `OTP_SECRET` in `apps/api/.env` must be at least 32 characters. |
| `DATABASE_URL is not set` / connection refused | Postgres isn't running or the URL is wrong. Docker: `docker compose ps`. Check user, password, port, database name. |
| `database "miniledger_test" does not exist` when testing | Create it (step 3). |
| `EADDRINUSE :4000` or `:8081` | An old server is still running. Close it, or find it (`netstat -ano \| findstr :4000` on Windows, `lsof -i :4000` on macOS/Linux) and stop it. |
| Can't find the login code | It's in the terminal running `npm run dev:api`, on a line containing `[MOCK OTP]`. |
| "Too many requests" when logging in | Max 5 codes per hour per number, 30 s between codes. Wait, or use a different number. |
| Camera doesn't open | Allow camera access for Expo Go in the phone's settings, or choose a photo from the gallery. |

---

## Design decisions

- **Money is integer paise** end to end (`amountMinor`), never floats.
- **Status is derived, never stored.** A loan is *overdue* when its due date is before today, *due soon* within 3 days, and *repaid* when payments cover the amount. Due today is not overdue.
- **"Today" is the user's calendar day** (time zone captured at login, default Asia/Kolkata), computed by the server per request, not taken from the phone.
- **Payments are concurrency-safe.** Each payment locks the loan row in a transaction, so simultaneous payments can never exceed the amount. A test proves it, and fails if the lock is removed.
- **Ownership is enforced in one place.** Another user's loan is indistinguishable from a missing one (404).
- **OTP security:** 6-digit CSPRNG codes stored only as HMACs, 5-minute expiry, 5 attempts, single use, 30 s resend cooldown and 5 requests/hour per phone. The server refuses to start with mock OTP delivery when `NODE_ENV=production`.
- **Receipts:** file type checked from the bytes (not the declared type), size capped while streaming, server-generated file names, served only through the authenticated route.
- **The summary is one SQL statement**, so its figures always describe the same snapshot. A test checks it always agrees with the loan list.
- **People are grouped by name** (ignoring case and extra spaces), so repeat borrowers add up automatically.

## Known limitations

- OTP delivery is mocked (printed to the console). A real SMS provider would implement the `OtpSender` interface.
- Receipts are stored on the API server's disk (`apps/api/uploads`); production would implement `ReceiptStorage` over object storage.
- People are matched by name: a typo creates a separate person, and two different friends with exactly the same name are merged.
- Single currency (INR). A loan's amount can't be edited once created (delete and re-add instead), so payment history always adds up.
- The mobile app has no automated UI tests; the 260 tests cover the backend and shared rules.
- `npm audit` reports moderate advisories in dev-only tooling (drizzle-kit's bundled esbuild); none ship in the app.
