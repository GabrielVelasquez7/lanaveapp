

## Problem

Two issues with "AGENCIAS ESTABLES" (and similar parent systems) in the encargada's Ventas/Premios view:

1. **Parent name not displayed**: When subcategories are grouped, the code tries to get the parent name from `parentSystem?.lottery_system_name`, but parent systems are excluded from the form data (replaced by their subcategories in `expandedSystems`). So `parentSystem` is always `null`, and it falls back to `children[0]?.lottery_system_name` which shows the child name (e.g., "Figuras") instead of "AGENCIAS ESTABLES".

2. **Data from AGENCIAS OR showing on AGENCIAS ESTABLES**: Since parent names aren't displayed, both groups look the same (both show "Figuras" or "Loterias"), making it appear that AGENCIAS OR data is on the wrong group. Additionally, the regex that strips "FIGURAS" from the name makes it even more confusing.

## Root Cause

`VentasPremiosEncargada` already builds a `parentSystemNameMap` (Map of parent_id → parent_name), but it's **never passed** to `VentasPremiosBolivaresEncargada` or `VentasPremiosDolaresEncargada`. Those components have no way to look up the real parent name.

## Fix

### 1. Pass `parentSystemNameMap` to both child components

In `VentasPremiosEncargada.tsx`, add the prop when rendering:
```tsx
<VentasPremiosBolivaresEncargada form={form} lotteryOptions={lotteryOptions} parentSystemNameMap={parentSystemNameMap} />
<VentasPremiosDolaresEncargada form={form} lotteryOptions={lotteryOptions} parentSystemNameMap={parentSystemNameMap} />
```

### 2. Update `VentasPremiosBolivaresEncargada.tsx`

- Add `parentSystemNameMap: Map<string, string>` to the props interface
- Replace the parent name resolution logic (line ~278):
  ```tsx
  // Before:
  const rawParentName = parentSystem?.lottery_system_name || children[0]?.lottery_system_name || 'Sistema Padre';
  const parentName = rawParentName.replace(/\s*-\s*FIGURAS\s*/gi, '').replace(/\s*FIGURAS\s*/gi, '').trim();
  
  // After:
  const parentName = parentSystemNameMap.get(parentId) || parentSystem?.lottery_system_name || 'Sistema Padre';
  ```
- Apply the same fix in the Parley section (~line 397 equivalent)

### 3. Update `VentasPremiosDolaresEncargada.tsx`

Same changes as the Bs component:
- Add `parentSystemNameMap` prop
- Use it for parent name resolution instead of falling back to child names

This ensures every parent group header shows the correct name (e.g., "AGENCIAS ESTABLES (Monto Taquillera)" vs "AGENCIAS OR (Monto Taquillera)"), making groups distinguishable.

