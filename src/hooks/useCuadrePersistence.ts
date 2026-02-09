import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDateForDB } from '@/lib/dateUtils';
import { useAuth } from './useAuth';

export interface CuadreState {
  exchangeRateInput: string;
  cashAvailableInput: string;
  cashAvailableUsdInput: string;
  pendingPrizesInput: string;
  pendingPrizesUsdInput: string;
  closureNotesInput: string;
  additionalAmountBsInput: string;
  additionalAmountUsdInput: string;
  additionalNotesInput: string;
  applyExcessUsdSwitch: boolean;
  fieldsEditedByUser: {
    exchangeRate: boolean;
    cashAvailable: boolean;
    cashAvailableUsd: boolean;
  };
}

const DEFAULT_STATE: CuadreState = {
  exchangeRateInput: "36.00",
  cashAvailableInput: "0",
  cashAvailableUsdInput: "0",
  pendingPrizesInput: "0",
  pendingPrizesUsdInput: "0",
  closureNotesInput: "",
  additionalAmountBsInput: "0",
  additionalAmountUsdInput: "0",
  additionalNotesInput: "",
  applyExcessUsdSwitch: true,
  fieldsEditedByUser: {
    exchangeRate: false,
    cashAvailable: false,
    cashAvailableUsd: false,
  },
};

export const useCuadrePersistence = (
  selectedAgency: string,
  selectedDate: Date,
  backendDataLoaded: boolean // Flag to know if backend data has been fetched
) => {
  const { user } = useAuth();
  const [persistedState, setPersistedState] = useState<CuadreState>(DEFAULT_STATE);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const isInitialLoad = useRef(true);

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
          // Merge with default to ensure all fields exist
          setPersistedState({ ...DEFAULT_STATE, ...parsed });
          setHasLoadedFromStorage(true);
        }
      } else {
         // If no persistence, and we haven't loaded backend data yet, keep default
         // Once backend data loads, this hook doesn't overwrite it, the consumer manages that.
         setHasLoadedFromStorage(false);
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
    isInitialLoad.current = false;
  }, [getStorageKey]); // Runs when key changes (date/agency change)

  // Save to storage
  const saveToStorage = useCallback((state: CuadreState) => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving persisted data:', error);
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
      console.error('Error clearing persisted data:', error);
    }
  }, [getStorageKey]);

  return {
    persistedState,
    hasLoadedFromStorage,
    saveToStorage,
    clearStorage
  };
};
