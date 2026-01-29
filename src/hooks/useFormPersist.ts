import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';

// Simple persistence helper for react-hook-form using localStorage
// - Restores values when the key (user+agency+date) is the same
// - Saves on every change
// - Exposes clearDraft to manually clear after submit
// - Exposes skipNextRestore to prevent restoration after manual data load
export function useFormPersist<T extends Record<string, any>>(key: string | null, form: UseFormReturn<T>) {
  const storageKey = useMemo(() => key ?? null, [key]);
  const skipRestoreRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Allow callers to skip the next restore (e.g., after loading from DB)
  const skipNextRestore = useCallback(() => {
    skipRestoreRef.current = true;
  }, []);

  // Restore on mount or when key changes
  useEffect(() => {
    if (!storageKey) return;
    
    // Skip restoration if explicitly requested
    if (skipRestoreRef.current) {
      skipRestoreRef.current = false;
      isInitializedRef.current = true;
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only reset if parsed is an object with systems array
        if (parsed && typeof parsed === 'object' && parsed.systems && Array.isArray(parsed.systems)) {
          // Check if there's actually any meaningful data to restore
          const hasData = parsed.systems.some((s: any) => 
            (s.sales_bs || 0) > 0 || (s.sales_usd || 0) > 0 || 
            (s.prizes_bs || 0) > 0 || (s.prizes_usd || 0) > 0
          );
          if (hasData) {
            form.reset(parsed);
          }
        }
      }
    } catch (_) {
      // ignore
    }
    isInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Subscribe to changes and persist
  useEffect(() => {
    if (!storageKey) return;
    const sub = form.watch((values) => {
      // Only persist after initialization to avoid saving empty/stale data
      if (!isInitializedRef.current) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(values));
      } catch (_) {
        // ignore quota errors
      }
    });
    return () => sub.unsubscribe();
  }, [form, storageKey]);

  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {
      // ignore
    }
  }, [storageKey]);

  return { clearDraft, skipNextRestore };
}
