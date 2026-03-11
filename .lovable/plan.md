

## Fix: Premios por Pagar empty field handling

### Problem
When the encargada clears the "Premios por Pagar (Bs)" field and saves, the taquillera's original value persists because:
1. The input allows empty strings (`''`)
2. localStorage stores `''`, but the merge logic (`isNonDefault`) skips empty strings, so the taquillera's base value wins
3. The DB overlay also skips zero values (`summaryPending > 0`), so even after saving 0, it won't override on next load

### Solution
The simplest fix: **auto-replace empty values with '0' in the input handler** for all numeric fields. When the user clears a field, it immediately becomes '0'. This prevents the cascade of issues.

### Changes

**File: `src/hooks/useCuadreGeneral.ts`**

1. **Update `setFormField`** (line ~89): For numeric fields (`exchangeRate`, `cashAvailable`, `cashAvailableUsd`, `pendingPrizes`, `pendingPrizesUsd`, `additionalAmountBs`, `additionalAmountUsd`), if the value is an empty string, replace it with `'0'`.

2. **Fix DB overlay logic** (lines 306-314): Change conditions like `summaryPending > 0` to `summaryPending >= 0` (or just always set the value) so that when the encargada saves 0, it's properly restored from DB on reload. Specifically:
   - `pendingPrizes: summaryPending > 0 ? ... : undefined` → `pendingPrizes: summaryPending.toString()`
   - Same for `pendingPrizesUsd`, `cashAvailable`, `cashAvailableUsd`, etc.

3. **Fix localStorage merge** (lines 337-338): Allow `'0'` as a valid persisted override for `pendingPrizes` and `pendingPrizesUsd` since the user may intentionally set them to 0. Change the check to only skip `undefined`:
   - `if (isNonDefault(persistedState.pendingPrizes, '0'))` → `if (persistedState.pendingPrizes !== undefined)`

This ensures the full flow works: user clears field → becomes '0' → saves as 0 → loads as 0.

