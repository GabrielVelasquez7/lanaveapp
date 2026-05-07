import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDateForDB } from '@/lib/dateUtils';
import { useAuth } from './useAuth';

/**
 * The persisted state shape matches the hook's formState directly.
 * No more format conversions — what the hook stores is what gets persisted.
 */
export interface PersistedFormState {
  exchangeRate: string;
  cashAvailable: string;
  cashAvailableUsd: string;
  pendingPrizes: string;
  pendingPrizesUsd: string;
  closureNotes: string;
  additionalAmountBs: string;
  additionalAmountUsd: string;
  additionalNotes: string;
  applyExcessUsd: boolean;
}

const DEFAULT_STATE: PersistedFormState = {
  exchangeRate: "36.00",
  cashAvailable: "0",
  cashAvailableUsd: "0",
  pendingPrizes: "0",
  pendingPrizesUsd: "0",
  closureNotes: "",
  additionalAmountBs: "0",
  additionalAmountUsd: "0",
  additionalNotes: "",
  applyExcessUsd: true,
};

export const useCuadrePersistence = (
  selectedAgency: string,
  selectedDate: Date,
  backendDataLoaded: boolean
) => {
  const { user } = useAuth();
  const [persistedState, setPersistedState] = useState<PersistedFormState>(DEFAULT_STATE);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Generate a unique key for storage
  const getStorageKey = useCallback(() => {
    if (!user || !selectedAgency || !selectedDate) return null;
    return `enc:cuadre-general:${user.id}:${selectedAgency}:${formatDateForDB(selectedDate)}`;
  }, [user, selectedAgency, selectedDate]);

  // Load from storage
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Migrate old format if needed (keys ending in Input/Switch)
          const migrated: PersistedFormState = {
            exchangeRate: parsed.exchangeRate ?? parsed.exchangeRateInput ?? DEFAULT_STATE.exchangeRate,
            cashAvailable: parsed.cashAvailable ?? parsed.cashAvailableInput ?? DEFAULT_STATE.cashAvailable,
            cashAvailableUsd: parsed.cashAvailableUsd ?? parsed.cashAvailableUsdInput ?? DEFAULT_STATE.cashAvailableUsd,
            pendingPrizes: parsed.pendingPrizes ?? parsed.pendingPrizesInput ?? DEFAULT_STATE.pendingPrizes,
            pendingPrizesUsd: parsed.pendingPrizesUsd ?? parsed.pendingPrizesUsdInput ?? DEFAULT_STATE.pendingPrizesUsd,
            closureNotes: parsed.closureNotes ?? parsed.closureNotesInput ?? DEFAULT_STATE.closureNotes,
            additionalAmountBs: parsed.additionalAmountBs ?? parsed.additionalAmountBsInput ?? DEFAULT_STATE.additionalAmountBs,
            additionalAmountUsd: parsed.additionalAmountUsd ?? parsed.additionalAmountUsdInput ?? DEFAULT_STATE.additionalAmountUsd,
            additionalNotes: parsed.additionalNotes ?? parsed.additionalNotesInput ?? DEFAULT_STATE.additionalNotes,
            applyExcessUsd: parsed.applyExcessUsd ?? parsed.applyExcessUsdSwitch ?? DEFAULT_STATE.applyExcessUsd,
          };
          // Ensure all values are strings (handle old format that stored numbers)
          migrated.exchangeRate = String(migrated.exchangeRate);
          migrated.cashAvailable = String(migrated.cashAvailable);
          migrated.cashAvailableUsd = String(migrated.cashAvailableUsd);
          migrated.pendingPrizes = String(migrated.pendingPrizes);
          migrated.pendingPrizesUsd = String(migrated.pendingPrizesUsd);
          migrated.additionalAmountBs = String(migrated.additionalAmountBs);
          migrated.additionalAmountUsd = String(migrated.additionalAmountUsd);

          setPersistedState(migrated);
          setHasLoadedFromStorage(true);
        }
      } else {
        setHasLoadedFromStorage(false);
      }
    } catch (error) {
      console.error('[Persistencia] Error cargando datos guardados localmente:', error);
    }
  }, [getStorageKey]);

  // Save to storage
  const saveToStorage = useCallback((state: PersistedFormState) => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('[Persistencia] Error guardando datos localmente:', error);
    }
  }, [getStorageKey]);

  // Clear storage
  const clearStorage = useCallback(() => {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
      setHasLoadedFromStorage(false);
    } catch (error) {
      console.error('[Persistencia] Error limpiando datos locales:', error);
    }
  }, [getStorageKey]);

  return {
    persistedState,
    hasLoadedFromStorage,
    saveToStorage,
    clearStorage
  };
};
