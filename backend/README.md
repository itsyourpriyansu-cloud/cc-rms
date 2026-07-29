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

### Step 4A — production order foundation

The persisted commerce foundation now includes:

- tenant-safe brands, categories, menu items, modifiers and outlet availability;
- versioned recipes, inventory components and immutable published recipe facts;
- expiring checkout quotes with immutable item, modifier, allergen and price
  snapshots;
- verified payment intents and single-use, idempotent quote-to-order conversion;
- database rejection of expired quotes, altered totals and mismatched payments;
- recipe-derived kitchen tasks with legal transitions and optimistic versions;
- append-only delivery milestones and order-risk evidence;
- typed quote, payment, order, task, milestone and risk event payloads;
- forced row-level security and composite tenant foreign keys throughout;
- PostgreSQL-compatible migration integration coverage for isolation,
  immutability, quote consumption and concurrent-version conflicts.

### Step 4B — quote, payment and checkout API

The transactional customer checkout path now provides:

- `POST /api/v1/customer/quotes` with authenticated, server-calculated prices;
- effective-dated outlet pricing policies for tax, delivery and packaging fees;
- request fingerprints and advisory locks for safe idempotent retries;
- `POST /api/v1/customer/payments/intents` through an explicit provider adapter;
- signed, normalized payment webhooks with amount and provider-reference checks;
- production startup rejection of the development payment provider;
- `POST /api/v1/customer/checkout` requiring an exact verified payment;
- mandatory acknowledgement of the accepted allergen snapshot;
- single-transaction order, immutable lines, kitchen tasks and first milestone;
- matching event-ledger and outbox facts committed with the commercial records;
- safe schema upgrade for quotes and payments created before Step 4B.

The built-in HTTP adapter is a low-cost normalization boundary. Before a live
launch, map it to the selected gateway, certify its webhook fields/signature
rules and run the concurrency suite against real PostgreSQL.

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

Build Step 4C: kitchen-task operations, append-only customer milestones, an SSE
tracking stream and the customer tracking adapter. Keep the current browser
checkout adapter in place until real-PostgreSQL concurrency CI and the selected
payment-provider certification pass.
