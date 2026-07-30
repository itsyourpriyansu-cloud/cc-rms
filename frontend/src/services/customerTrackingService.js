import api from './api';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const toServiceError = (error, fallbackMessage) => {
  const serviceError = new Error(
    error?.response?.data?.error?.message || fallbackMessage
  );
  serviceError.code =
    error?.response?.data?.error?.code || 'TRACKING_NETWORK_ERROR';
  return serviceError;
};

export const customerTrackingService = {
  async getSnapshot(orderId) {
    try {
      const response = await api.get(
        `/customer/orders/${encodeURIComponent(orderId)}/tracking`
      );
      return response.data.tracking;
    } catch (error) {
      throw toServiceError(error, 'Unable to load live order tracking');
    }
  },

  subscribe(orderId, handlers = {}) {
    if (typeof EventSource === 'undefined') return null;

    const stream = new EventSource(
      `${apiBaseUrl}/customer/orders/${encodeURIComponent(orderId)}/tracking/stream`,
      { withCredentials: true }
    );
    const eventNames = [
      'tracking.snapshot',
      'order.status_changed',
      'kitchen.task_status_changed',
      'delivery.milestone_recorded',
      'delivery.assignment_updated',
      'delivery.location_updated',
      'tracking.error',
    ];
    const listeners = new Map();

    eventNames.forEach((eventName) => {
      const listener = (event) => {
        try {
          handlers.onEvent?.(eventName, JSON.parse(event.data));
        } catch {
          handlers.onMalformedEvent?.(eventName);
        }
      };
      listeners.set(eventName, listener);
      stream.addEventListener(eventName, listener);
    });
    stream.onopen = () => handlers.onOpen?.();
    stream.onerror = () => handlers.onError?.();

    return () => {
      listeners.forEach((listener, eventName) => {
        stream.removeEventListener(eventName, listener);
      });
      stream.close();
    };
  },
};
