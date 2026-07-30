import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  OutletIdSchema,
  TenantIdSchema,
  UserIdSchema,
} from '../contracts/index.js';

const OperationsEnvironmentSchema = z.object({
  OPERATIONS_API_SECRET: z.string().min(32),
  OPERATIONS_SIGNATURE_TOLERANCE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(600)
    .default(300),
});

export type OperationsAuthConfig = z.infer<
  typeof OperationsEnvironmentSchema
>;

export type OperationsPrincipal = {
  tenantId: string;
  outletId: string;
  actorId: string;
  role: 'kitchen' | 'manager' | 'delivery_partner' | 'system';
};

export class OperationsAuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OperationsAuthError';
  }
}

export const readOperationsAuthConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): OperationsAuthConfig => OperationsEnvironmentSchema.parse(environment);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
};

const canonicalRequest = (input: {
  method: string;
  path: string;
  timestamp: string;
  principal: OperationsPrincipal;
  body: unknown;
}): string =>
  [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.principal.tenantId,
    input.principal.outletId,
    input.principal.actorId,
    input.principal.role,
    JSON.stringify(stableValue(input.body)),
  ].join('\n');

export const signOperationsRequest = (
  secret: string,
  input: {
    method: string;
    path: string;
    timestamp: string;
    principal: OperationsPrincipal;
    body: unknown;
  },
): string =>
  `sha256=${createHmac('sha256', secret)
    .update(canonicalRequest(input))
    .digest('hex')}`;

export class OperationsRequestVerifier {
  constructor(private readonly config: OperationsAuthConfig) {}

  verify(input: {
    method: string;
    path: string;
    timestamp: string | undefined;
    signature: string | undefined;
    tenantId: string | undefined;
    outletId: string | undefined;
    actorId: string | undefined;
    role: string | undefined;
    body: unknown;
  }): OperationsPrincipal {
    const principalResult = z
      .object({
        tenantId: TenantIdSchema,
        outletId: OutletIdSchema,
        actorId: z.union([
          UserIdSchema,
          z.string().regex(/^(partner|system)_[A-Za-z0-9_-]{6,80}$/),
        ]),
        role: z.enum(['kitchen', 'manager', 'delivery_partner', 'system']),
      })
      .safeParse({
        tenantId: input.tenantId,
        outletId: input.outletId,
        actorId: input.actorId,
        role: input.role,
      });
    if (!principalResult.success) {
      throw new OperationsAuthError(
        'OPERATIONS_IDENTITY_INVALID',
        401,
        'The operations identity is invalid',
      );
    }
    const principal = principalResult.data;

    if (!input.timestamp || !input.signature) {
      throw new OperationsAuthError(
        'OPERATIONS_SIGNATURE_REQUIRED',
        401,
        'A signed operations request is required',
      );
    }
    const timestampMs = Date.parse(input.timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) >
        this.config.OPERATIONS_SIGNATURE_TOLERANCE_SECONDS * 1_000
    ) {
      throw new OperationsAuthError(
        'OPERATIONS_SIGNATURE_EXPIRED',
        401,
        'The operations signature has expired',
      );
    }

    const expected = signOperationsRequest(this.config.OPERATIONS_API_SECRET, {
      method: input.method,
      path: input.path,
      timestamp: input.timestamp,
      principal,
      body: input.body,
    });
    const supplied = input.signature;
    const valid =
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) {
      throw new OperationsAuthError(
        'OPERATIONS_SIGNATURE_INVALID',
        401,
        'The operations signature is invalid',
      );
    }

    return principal;
  }
}
