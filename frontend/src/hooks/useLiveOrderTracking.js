import { useEffect, useRef, useState } from 'react';
import { customerTrackingService } from '../services/customerTrackingService';

const REFRESH_DEBOUNCE_MS = 250;
const FALLBACK_POLL_MS = 10_000;

export const useLiveOrderTracking = (orderId, enabled) => {
  const [tracking, setTracking] = useState(null);
  const [connection, setConnection] = useState('idle');
  const [error, setError] = useState(null);
  const refreshTimer = useRef(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      setTracking(null);
      setConnection('idle');
      setError(null);
      return undefined;
    }

    let active = true;
    let pollTimer = null;
    const refresh = async () => {
      try {
        const snapshot = await customerTrackingService.getSnapshot(orderId);
        if (!active) return;
        setTracking(snapshot);
        setError(null);
      } catch (refreshError) {
        if (!active) return;
        setError(refreshError);
        setConnection((current) =>
          current === 'live' ? 'reconnecting' : 'unavailable'
        );
      }
    };
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    };

    setConnection('connecting');
    void refresh();
    const unsubscribe = customerTrackingService.subscribe(orderId, {
      onOpen: () => {
        if (active) setConnection('live');
      },
      onError: () => {
        if (active) setConnection('reconnecting');
      },
      onEvent: (eventName, payload) => {
        if (!active) return;
        if (eventName === 'tracking.snapshot') {
          setTracking(payload);
          setError(null);
          return;
        }
        scheduleRefresh();
      },
    });

    if (!unsubscribe) {
      setConnection('polling');
      pollTimer = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    }

    return () => {
      active = false;
      unsubscribe?.();
      if (pollTimer) clearInterval(pollTimer);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [enabled, orderId]);

  return { tracking, connection, error };
};
