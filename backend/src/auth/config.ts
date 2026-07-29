import { z } from 'zod';

const AuthEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AUTH_PEPPER: z.string().min(32),
    OTP_PROVIDER: z.enum(['development', 'http']).default('development'),
    DEV_OTP_CODE: z.string().regex(/^\d{6}$/).default('123456'),
    OTP_HTTP_URL: z.url().optional(),
    OTP_HTTP_TOKEN: z.string().min(16).optional(),
    OTP_HTTP_SENDER: z.string().min(2).max(30).optional(),
    OTP_HTTP_TEMPLATE_ID: z.string().min(1).max(100).optional(),
    OTP_TTL_SECONDS: z.coerce.number().int().min(120).max(600).default(300),
    OTP_COOLDOWN_SECONDS: z.coerce.number().int().min(30).max(300).default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SESSION_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default(false),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production' && environment.OTP_PROVIDER === 'development') {
      context.addIssue({
        code: 'custom',
        path: ['OTP_PROVIDER'],
        message: 'Development OTP provider is prohibited in production',
      });
    }

    if (environment.NODE_ENV === 'production' && !environment.SESSION_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_COOKIE_SECURE'],
        message: 'Production session cookies must be secure',
      });
    }

    if (environment.OTP_PROVIDER === 'http') {
      for (const key of [
        'OTP_HTTP_URL',
        'OTP_HTTP_TOKEN',
        'OTP_HTTP_SENDER',
        'OTP_HTTP_TEMPLATE_ID',
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required for the HTTP OTP provider`,
          });
        }
      }
    }
  });

export type AuthConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  pepper: string;
  provider: 'development' | 'http';
  developmentOtp: string;
  otpHttpUrl?: string;
  otpHttpToken?: string;
  otpHttpSender?: string;
  otpHttpTemplateId?: string;
  otpTtlSeconds: number;
  otpCooldownSeconds: number;
  otpMaxAttempts: number;
  sessionTtlDays: number;
  secureCookie: boolean;
};

export const readAuthConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfig => {
  const parsed = AuthEnvironmentSchema.parse(environment);

  return {
    nodeEnv: parsed.NODE_ENV,
    pepper: parsed.AUTH_PEPPER,
    provider: parsed.OTP_PROVIDER,
    developmentOtp: parsed.DEV_OTP_CODE,
    otpTtlSeconds: parsed.OTP_TTL_SECONDS,
    otpCooldownSeconds: parsed.OTP_COOLDOWN_SECONDS,
    otpMaxAttempts: parsed.OTP_MAX_ATTEMPTS,
    sessionTtlDays: parsed.SESSION_TTL_DAYS,
    secureCookie: parsed.SESSION_COOKIE_SECURE,
    ...(parsed.OTP_HTTP_URL ? { otpHttpUrl: parsed.OTP_HTTP_URL } : {}),
    ...(parsed.OTP_HTTP_TOKEN ? { otpHttpToken: parsed.OTP_HTTP_TOKEN } : {}),
    ...(parsed.OTP_HTTP_SENDER ? { otpHttpSender: parsed.OTP_HTTP_SENDER } : {}),
    ...(parsed.OTP_HTTP_TEMPLATE_ID
      ? { otpHttpTemplateId: parsed.OTP_HTTP_TEMPLATE_ID }
      : {}),
  };
};
