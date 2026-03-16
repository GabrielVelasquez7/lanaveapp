import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT_MS = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
const STORAGE_KEY = 'lastActivityTimestamp';

/**
 * Hook that monitors user activity and logs out after 7 hours of inactivity.
 * Activity is tracked across page reloads using localStorage.
 */
export const useInactivityTimeout = () => {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }, []);

  // Check if session should expire due to inactivity
  const checkInactivity = useCallback(async () => {
    const lastActivity = localStorage.getItem(STORAGE_KEY);
    
    if (!lastActivity) {
      // No activity recorded, set current time
      updateActivity();
      return;
    }

    const lastActivityTime = parseInt(lastActivity, 10);
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
      console.log('[Inactivity] 7 hours of inactivity detected, logging out...');
      
      // Clear the activity timestamp
      localStorage.removeItem(STORAGE_KEY);
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Redirect to auth page
      window.location.href = '/auth';
    }
  }, [updateActivity]);

  useEffect(() => {
    // Initialize activity timestamp if not exists
    if (!localStorage.getItem(STORAGE_KEY)) {
      updateActivity();
    }

    // Events that indicate user activity
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Throttle activity updates to avoid excessive localStorage writes
    let lastUpdateTime = 0;
    const throttledUpdateActivity = () => {
      const now = Date.now();
      // Only update every 30 seconds at most
      if (now - lastUpdateTime > 30000) {
        lastUpdateTime = now;
        updateActivity();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Start interval to check for inactivity
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // Run initial check
    checkInactivity();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledUpdateActivity);
      });
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [updateActivity, checkInactivity]);
};
