import { mockApiDelay } from './api';

export const cartService = {
  // Validate cart items availability and pricing with backend
  async validateCart(items) {
    try {
      // Production: return await api.post('/cart/validate', { items });
      return await mockApiDelay({ isValid: true, items });
    } catch (error) {
      console.error("Cart validation error:", error);
      throw error;
    }
  },

  // Apply discount voucher / promo code
  async applyPromoCode(code, cart = {}) {
    try {
      const validPromos = {
        'MANGAMMA10': { discountPercent: 10, code: 'MANGAMMA10', description: '10% off your order', minimumOrder: 299 },
        'BIRYANI10': { discountPercent: 10, code: 'BIRYANI10', description: '10% off biryanis', minimumOrder: 250, requiresBiryani: true },
        'WELCOME20': { discountPercent: 20, code: 'WELCOME20', description: '20% welcome feast discount', minimumOrder: 499, firstOrderOnly: true }
      };

      const promo = validPromos[code.trim().toUpperCase()];
      if (promo) {
        const subtotal = Number(cart.subtotal || 0);
        if (subtotal < promo.minimumOrder) {
          return await mockApiDelay({
            success: false,
            message: `Add ₹${Math.ceil(promo.minimumOrder - subtotal)} more to use ${promo.code}`,
          }, 250);
        }
        if (
          promo.requiresBiryani &&
          !(cart.cartItems || []).some((item) =>
            `${item.category || ''} ${item.name || ''}`.toLowerCase().includes('biryani')
          )
        ) {
          return await mockApiDelay({
            success: false,
            message: 'Add a biryani to use BIRYANI10',
          }, 250);
        }
        if (promo.firstOrderOnly && !cart.isFirstOrder) {
          return await mockApiDelay({
            success: false,
            message: 'WELCOME20 is available only on your first order',
          }, 250);
        }
        return await mockApiDelay({ success: true, promo });
      } else {
        return await mockApiDelay({ success: false, message: 'Invalid or expired promo code' }, 300);
      }
    } catch (error) {
      console.error("Error applying promo code:", error);
      throw error;
    }
  }
};
