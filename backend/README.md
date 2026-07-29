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

## Commands

```bash
npm install
npm run check
npm run build
npm run migrate:local
```

`npm run check` type-checks the package and runs the contract tests.

Copy `.env.example` to `.env` and replace its credentials before running a
migration locally. In hosted environments, provide `DATABASE_URL` and the
database settings through the platform and use `npm run migrate`. The
application database role should not be a PostgreSQL superuser; superusers can
bypass row-level security.

## Next step

Add the phone authentication API, OTP provider boundary and secure customer
sessions, then migrate customer identity away from browser-only storage.
