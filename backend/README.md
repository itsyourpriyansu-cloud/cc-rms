# RMS Backend Foundation

This directory contains the production backend for the AI-native cloud-kitchen
operating system.

The implementation follows the protocol defined in
[`../reports/ai-native-cloud-kitchen-operating-system-architecture.md`](../reports/ai-native-cloud-kitchen-operating-system-architecture.md).

## Completed: Step 1 — canonical contracts

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

## Commands

```bash
npm install
npm run check
```

`npm run check` type-checks the package and runs the contract tests.

## Next step

Add the PostgreSQL schema, migrations, tenant isolation and transactional
outbox using these contracts as the source vocabulary.
