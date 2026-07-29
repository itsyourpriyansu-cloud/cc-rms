import type { AuthConfig } from './config.js';

export type OtpDelivery = {
  providerReference: string;
};

export type SendOtpInput = {
  phoneE164: string;
  code: string;
  expiresInSeconds: number;
};

export interface OtpProvider {
  send(input: SendOtpInput): Promise<OtpDelivery>;
}

export class DevelopmentOtpProvider implements OtpProvider {
  async send(input: SendOtpInput): Promise<OtpDelivery> {
    process.stdout.write(
      `[development-otp] ${input.phoneE164} code=${input.code} expires=${input.expiresInSeconds}s\n`,
    );
    return { providerReference: `development:${Date.now()}` };
  }
}

export class HttpOtpProvider implements OtpProvider {
  constructor(private readonly config: AuthConfig) {}

  async send(input: SendOtpInput): Promise<OtpDelivery> {
    if (
      !this.config.otpHttpUrl ||
      !this.config.otpHttpToken ||
      !this.config.otpHttpSender ||
      !this.config.otpHttpTemplateId
    ) {
      throw new Error('HTTP OTP provider is not configured');
    }

    const response = await fetch(this.config.otpHttpUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.otpHttpToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: input.phoneE164,
        sender: this.config.otpHttpSender,
        templateId: this.config.otpHttpTemplateId,
        variables: {
          otp: input.code,
          expiryMinutes: Math.ceil(input.expiresInSeconds / 60),
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`OTP provider rejected delivery with status ${response.status}`);
    }

    const body = (await response.json()) as { messageId?: string };
    if (!body.messageId) {
      throw new Error('OTP provider response did not include a message ID');
    }

    return { providerReference: body.messageId };
  }
}

export const createOtpProvider = (config: AuthConfig): OtpProvider =>
  config.provider === 'development'
    ? new DevelopmentOtpProvider()
    : new HttpOtpProvider(config);
