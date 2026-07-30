import { describe, expect, it } from 'vitest';
import {
  OperationsRequestVerifier,
  readOperationsAuthConfig,
  signOperationsRequest,
} from '../src/operations/index.js';

const secret = 'operations-signing-secret-that-is-long-enough-for-tests';
const principal = {
  tenantId: 'ten_demo01',
  outletId: 'out_demo01',
  actorId: 'usr_demo01',
  role: 'kitchen' as const,
};
const body = {
  outletId: 'out_demo01',
  expectedVersion: 1,
  toStatus: 'in_progress',
};

describe('signed internal operations boundary', () => {
  it('accepts a current canonical request signature', () => {
    const verifier = new OperationsRequestVerifier(
      readOperationsAuthConfig({
        OPERATIONS_API_SECRET: secret,
        OPERATIONS_SIGNATURE_TOLERANCE_SECONDS: '300',
      }),
    );
    const timestamp = new Date().toISOString();
    const path = '/api/v1/internal/kitchen/tasks/tsk_demo01/transition';
    const signature = signOperationsRequest(secret, {
      method: 'POST',
      path,
      timestamp,
      principal,
      body,
    });

    expect(
      verifier.verify({
        method: 'POST',
        path,
        timestamp,
        signature,
        ...principal,
        body,
      }),
    ).toEqual(principal);
  });

  it('rejects body tampering and expired signatures', () => {
    const verifier = new OperationsRequestVerifier(
      readOperationsAuthConfig({
        OPERATIONS_API_SECRET: secret,
        OPERATIONS_SIGNATURE_TOLERANCE_SECONDS: '60',
      }),
    );
    const timestamp = new Date().toISOString();
    const path = '/api/v1/internal/kitchen/tasks/tsk_demo01/transition';
    const signature = signOperationsRequest(secret, {
      method: 'POST',
      path,
      timestamp,
      principal,
      body,
    });

    expect(() =>
      verifier.verify({
        method: 'POST',
        path,
        timestamp,
        signature,
        ...principal,
        body: { ...body, expectedVersion: 2 },
      }),
    ).toThrow(/signature is invalid/);

    const expired = new Date(Date.now() - 120_000).toISOString();
    expect(() =>
      verifier.verify({
        method: 'POST',
        path,
        timestamp: expired,
        signature: signOperationsRequest(secret, {
          method: 'POST',
          path,
          timestamp: expired,
          principal,
          body,
        }),
        ...principal,
        body,
      }),
    ).toThrow(/expired/);
  });

  it('rejects malformed operator identity as an authentication failure', () => {
    const verifier = new OperationsRequestVerifier(
      readOperationsAuthConfig({
        OPERATIONS_API_SECRET: secret,
      }),
    );

    expect(() =>
      verifier.verify({
        method: 'POST',
        path: '/api/v1/internal/kitchen/tasks/tsk_demo01/transition',
        timestamp: new Date().toISOString(),
        signature: 'sha256=invalid',
        tenantId: 'wrong',
        outletId: principal.outletId,
        actorId: principal.actorId,
        role: principal.role,
        body,
      }),
    ).toThrow(/identity is invalid/);
  });
});
