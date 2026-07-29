import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const createOpaqueId = (prefix: string): string =>
  `${prefix}_${randomBytes(18).toString('base64url')}`;

export const createSessionToken = (tenantId: string): string =>
  `${tenantId}.${randomBytes(32).toString('base64url')}`;

export const createOtpCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

export const keyedDigest = (pepper: string, value: string): string =>
  createHmac('sha256', pepper).update(value).digest('hex');

export const otpDigest = (
  pepper: string,
  challengeId: string,
  phoneE164: string,
  code: string,
): string => keyedDigest(pepper, `${challengeId}:${phoneE164}:${code}`);

export const safeDigestEqual = (left: string, right: string): boolean => {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};

export const normaliseIndianPhone = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  const nationalNumber =
    digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error('Enter a valid Indian mobile number');
  }

  return `+91${nationalNumber}`;
};
