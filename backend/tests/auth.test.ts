import { describe, expect, it } from 'vitest';
import { readAuthConfig } from '../src/auth/config.js';
import {
  keyedDigest,
  normaliseIndianPhone,
  otpDigest,
  safeDigestEqual,
} from '../src/auth/crypto.js';

const pepper = 'test-pepper-that-is-definitely-longer-than-32-characters';

describe('customer authentication configuration', () => {
  it('allows an explicit local development provider', () => {
    expect(
      readAuthConfig({
        NODE_ENV: 'development',
        AUTH_PEPPER: pepper,
        OTP_PROVIDER: 'development',
        SESSION_COOKIE_SECURE: 'false',
      }),
    ).toMatchObject({
      nodeEnv: 'development',
      provider: 'development',
      developmentOtp: '123456',
      otpTtlSeconds: 300,
      otpMaxAttempts: 5,
      sessionTtlDays: 30,
      secureCookie: false,
    });
  });

  it('refuses development OTPs or insecure cookies in production', () => {
    expect(() =>
      readAuthConfig({
        NODE_ENV: 'production',
        AUTH_PEPPER: pepper,
        OTP_PROVIDER: 'development',
        SESSION_COOKIE_SECURE: 'false',
      }),
    ).toThrow(/prohibited in production/);
  });

  it('requires all credentials for the production HTTP provider', () => {
    expect(() =>
      readAuthConfig({
        NODE_ENV: 'production',
        AUTH_PEPPER: pepper,
        OTP_PROVIDER: 'http',
        SESSION_COOKIE_SECURE: 'true',
      }),
    ).toThrow(/OTP_HTTP_URL/);
  });
});

describe('phone and secret handling', () => {
  it('normalises Indian national and E.164-like input', () => {
    expect(normaliseIndianPhone('98765 43210')).toBe('+919876543210');
    expect(normaliseIndianPhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('rejects invalid Indian mobile numbers', () => {
    expect(() => normaliseIndianPhone('1234567890')).toThrow(
      'Enter a valid Indian mobile number',
    );
  });

  it('binds an OTP digest to its challenge and phone number', () => {
    const expected = otpDigest(pepper, 'otp_challenge01', '+919876543210', '123456');
    const wrongChallenge = otpDigest(
      pepper,
      'otp_challenge02',
      '+919876543210',
      '123456',
    );

    expect(safeDigestEqual(expected, expected)).toBe(true);
    expect(safeDigestEqual(expected, wrongChallenge)).toBe(false);
    expect(keyedDigest(pepper, 'raw-session-token')).toHaveLength(64);
  });
});
