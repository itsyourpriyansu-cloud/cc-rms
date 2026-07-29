import { mockApiDelay } from './api';
import { parseIndianMobile } from '../utils/whatsapp';

const DEMO_OTP = '123456';

export const customerAuthService = {
  async requestOtp(rawPhone) {
    const parsed = parseIndianMobile(rawPhone);
    if (!parsed.isValid) {
      throw new Error('Enter a valid 10-digit Indian mobile number');
    }

    return mockApiDelay({
      success: true,
      requestId: `OTP-${Date.now()}`,
      phone: parsed.digits10,
      expiresAt: Date.now() + 5 * 60 * 1000,
      demoOtp: DEMO_OTP,
    }, 450);
  },

  async verifyOtp({ phone, otp, requestId }) {
    if (!requestId || String(otp).trim() !== DEMO_OTP) {
      throw new Error('The OTP is incorrect or has expired');
    }

    return mockApiDelay({
      success: true,
      session: {
        phone,
        e164: `91${phone}`,
        accessToken: `demo-customer-${phone}-${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        isDemoSession: true,
      },
    }, 500);
  },
};

export const CUSTOMER_DEMO_OTP = DEMO_OTP;
