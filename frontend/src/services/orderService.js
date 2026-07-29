import { mockApiDelay } from './api';
import { generateOrderId } from '../utils/formatters';

export const orderService = {
  // Place new kitchen order
  async createOrder(orderPayload) {
    try {
      // Production: const res = await api.post('/orders', orderPayload);
      const newOrder = {
        orderId: generateOrderId(),
        customer: orderPayload.customer,
        fulfillment: orderPayload.fulfillment,
        orderType: orderPayload.fulfillment?.type || 'DELIVERY',
        items: orderPayload.items,
        totals: orderPayload.totals,
        appliedPromo: orderPayload.appliedPromo || null,
        specialNotes: orderPayload.specialNotes || '',
        status: 'received', // 'received' | 'preparing' | 'ready' | 'served'
        createdAt: new Date().toISOString(),
        estimatedMinutes: 20,
      };
      return await mockApiDelay(newOrder, 800);
    } catch (error) {
      console.error("Error placing order:", error);
      throw error;
    }
  },

  // Get current order status
  async getOrderStatus(orderId) {
    try {
      return await mockApiDelay({
        orderId,
        status: 'preparing',
        currentStep: 2, // 1: received, 2: preparing, 3: ready, 4: served
        estimatedRemainingMinutes: 14,
      });
    } catch (error) {
      console.error("Error getting order status:", error);
      throw error;
    }
  },

  // Request waiter or table assistance
  async requestAssistance(tableNumber, requestType = 'Waiter Call') {
    try {
      return await mockApiDelay({
        success: true,
        message: `Assistance requested (${requestType}) for Table #${tableNumber}. Staff notified!`,
        timestamp: new Date().toISOString()
      }, 500);
    } catch (error) {
      console.error("Error calling waiter:", error);
      throw error;
    }
  }
};
