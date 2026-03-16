import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
const STORAGE_KEY = 'lastActivityTimestamp';

/**
 * Hook that monitors user activity and logs out after 7 hours of inactivity.
 * Activity is tracked across page reloads using localStorage.
 */
export const useInactivityTimeout = (enabled = true) => {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateActivity = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }, []);

  const checkInactivity = useCallback(async () => {
    const lastActivity = localStorage.getItem(STORAGE_KEY);

    if (!lastActivity) {
      updateActivity();
      return;
    }

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
      console.log('[Inactivity] 7 hours of inactivity detected, logging out...');
      localStorage.removeItem(STORAGE_KEY);
      await supabase.auth.signOut();
      window.location.href = '/auth';
    }
  }, [updateActivity]);

  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      return;
    }

    if (!localStorage.getItem(STORAGE_KEY)) {
      updateActivity();
    }

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    let lastUpdateTime = 0;
    const throttledUpdateActivity = () => {
      const now = Date.now();
      if (now - lastUpdateTime > 30000) {
        lastUpdateTime = now;
        updateActivity();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS);
    void checkInactivity();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledUpdateActivity);
      });

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, updateActivity, checkInactivity]);
};
