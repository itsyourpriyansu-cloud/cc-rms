import api from './api';
import { restaurantConfig } from '../config/restaurantConfig';
import { parseIndianMobile } from '../utils/whatsapp';

const throwServiceError = (error, fallbackMessage) => {
  const serviceError = new Error(
    error?.response?.data?.error?.message || fallbackMessage
  );
  serviceError.code = error?.response?.data?.error?.code || 'NETWORK_ERROR';
  serviceError.retryAfterSeconds =
    error?.response?.data?.error?.retryAfterSeconds || null;
  throw serviceError;
};

const toUiProfile = (customer) => ({
  customerId: customer.id,
  firstName: customer.firstName,
  phone: customer.phone,
  e164: customer.phoneE164,
  dietaryPreference: String(customer.dietaryPreference || 'no_preference').toUpperCase(),
  spicePreference: String(customer.spicePreference || 'medium').toUpperCase(),
  allergies: customer.allergies || [],
  marketingConsent: Boolean(customer.marketingConsent),
});

export const customerAuthService = {
  async requestOtp(rawPhone) {
    const parsed = parseIndianMobile(rawPhone);
    if (!parsed.isValid) {
      throw new Error('Enter a valid 10-digit Indian mobile number');
    }

    try {
      const response = await api.post('/customer/auth/otp/request', {
        tenantId: restaurantConfig.tenantId,
        outletId: restaurantConfig.outletId,
        phone: parsed.digits10,
      });
      return { data: response.data.challenge };
    } catch (error) {
      return throwServiceError(error, 'Unable to send OTP right now');
    }
  },

  async verifyOtp({ phone, otp, requestId, firstName }) {
    try {
      const response = await api.post('/customer/auth/otp/verify', {
        tenantId: restaurantConfig.tenantId,
        outletId: restaurantConfig.outletId,
        phone,
        otp: String(otp).trim(),
        requestId,
        firstName: String(firstName).trim(),
      });
      const profile = toUiProfile(response.data.customer);
      return {
        data: {
          session: {
            phone: profile.phone,
            e164: profile.e164,
            authenticatedAt: response.data.session.authenticatedAt,
            expiresAt: response.data.session.expiresAt,
          },
          profile,
        },
      };
    } catch (error) {
      return throwServiceError(error, 'OTP verification failed');
    }
  },

  async getSession() {
    try {
      const response = await api.get('/customer/auth/me');
      const profile = toUiProfile(response.data.customer);
      return {
        data: {
          session: {
            phone: profile.phone,
            e164: profile.e164,
            authenticatedAt: null,
          },
          profile,
        },
      };
    } catch (error) {
      if (error?.response?.status === 401) return null;
      return throwServiceError(error, 'Unable to restore your session');
    }
  },

  async updateProfile(updates) {
    try {
      const response = await api.patch('/customer/profile', {
        ...(updates.firstName !== undefined ? { firstName: updates.firstName } : {}),
        ...(updates.dietaryPreference !== undefined
          ? { dietaryPreference: updates.dietaryPreference.toLowerCase() }
          : {}),
        ...(updates.spicePreference !== undefined
          ? { spicePreference: updates.spicePreference.toLowerCase() }
          : {}),
        ...(updates.allergies !== undefined ? { allergies: updates.allergies } : {}),
        ...(updates.marketingConsent !== undefined
          ? { marketingConsent: updates.marketingConsent }
          : {}),
      });
      return { data: toUiProfile(response.data.customer) };
    } catch (error) {
      return throwServiceError(error, 'Unable to save your preferences');
    }
  },

  async signOut() {
    try {
      await api.post('/customer/auth/logout');
    } catch (error) {
      if (error?.response?.status !== 401) {
        return throwServiceError(error, 'Unable to sign out');
      }
    }
    return { success: true };
  },
};
