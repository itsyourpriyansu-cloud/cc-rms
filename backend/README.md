# RMS Backend Foundation

This directory contains the production backend for the AI-native cloud-kitchen
operating system.

The implementation follows the protocol defined in
[`../reports/ai-native-cloud-kitchen-operating-system-architecture.md`](../reports/ai-native-cloud-kitchen-operating-system-architecture.md).

## Completed foundation

### Step 1 — canonical contracts

The first foundation step defines and validates:

- tenant, outlet, customer and consent records;
- the order lifecycle and legal state transitions;
- CloudEvents-compatible MAOS event envelopes;
- typed AI decision proposals;
- approval and risk constraints;
- immutable action receipts.

These contracts are deliberately independent of HTTP, databases and AI
providers. Later steps must import them rather than inventing new payload
shapes.

### Step 2 — PostgreSQL and tenant isolation

The persistence foundation now includes:

- a versioned PostgreSQL migration;
- row-level security forced on every tenant-owned table;
- composite tenant foreign keys that prevent cross-tenant relationships;
- validated tenant transaction context;
- legal order-transition enforcement in both TypeScript and PostgreSQL;
- append-only event, approval, status and action records;
- a transactional event ledger and outbox;
- checksummed, advisory-locked migration execution.

### Step 3 — customer phone authentication

The customer identity flow now uses:

- rate-limited, single-use OTP challenges;
- keyed OTP digests instead of stored OTP values;
- an explicit SMS-provider boundary;
- opaque sessions stored only as keyed digests;
- HttpOnly, SameSite session cookies;
- server-side session restoration and revocation;
- persisted customer preferences and consent;
- MAOS authentication events written through the transactional outbox;
- production startup checks that prohibit development OTPs and insecure cookies.

## Commands

```bash
npm install
npm run check
npm run build
npm run migrate:local
npm run seed:development
npm run dev
```

`npm run check` type-checks the package and runs the contract tests.

Copy `.env.example` to `.env` and replace its credentials before running a
migration locally. In hosted environments, provide `DATABASE_URL` and the
database settings through the platform and use `npm run migrate`. The
application database role should not be a PostgreSQL superuser; superusers can
bypass row-level security.

For local development, the OTP is shown in the terminal and returned to the
local login screen. It is never returned when a production SMS provider is
configured.

## Next step

Build the persisted order vertical slice: checkout, kitchen tasks, live
milestones and the first order-risk projection.
