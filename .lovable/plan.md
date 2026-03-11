

## Plan: Corregir discrepancia de datos al recargar cuadre de encargada

### Problema Identificado

Existe una **condicion de carrera** (race condition) entre el hook `useCuadreGeneral` y el componente `CuadreGeneralEncargada` que causa que los valores editados por la encargada se pierdan al recargar.

**Datos de Baralt 23 de febrero como evidencia:**
- Taquillera registro: efectivo Bs = 30,010
- Encargada corrigio a: efectivo Bs = 32,870 (diferencia = 2,860)
- Al recargar, el sistema usa 30,010 en vez de 32,870, causando que el balance pase de -21.70 a -2,881.70

### Causa Raiz

En `useCuadreGeneral.ts` (lineas 630-641), el hook retorna el objeto `cuadre` sobreescribiendo los valores de la base de datos con `formState`:

```text
cuadre: {
    ...cuadre,                           // <-- valores de BD (cash=32870)
    cashAvailable: parseFloat(formState.cashAvailable),  // <-- formState='0' (aun no inicializado)
}
```

**Secuencia del problema:**
1. El hook hace fetch de datos -> `summaryData.cash_available_bs = 32870`
2. El memo calcula `cuadre.cashAvailable = 32870` (correcto)
3. PERO el return sobreescribe con `formState.cashAvailable = 0` (formState aun no se sincronizo)
4. El componente lee `cuadre.cashAvailable = 0` y cae al fallback: `taquilleraDefaults.cashBs = 30010`
5. Se inicializa `cashAvailableInput = 30010` y se marca como inicializado
6. Cuando formState finalmente se sincroniza a 32870, el componente ya no se actualiza (initializedRef = true)

### Solucion

**Archivo 1: `src/hooks/useCuadreGeneral.ts`**

Eliminar las sobreescrituras de formState en el return del hook (lineas 630-641). El cuadre debe reflejar siempre los valores de la base de datos, no los del formState sin inicializar:

```typescript
// ANTES (problematico):
return {
    cuadre: {
        ...cuadre,
        cashAvailable: parseFloat(formState.cashAvailable),
        cashAvailableUsd: parseFloat(formState.cashAvailableUsd),
        exchangeRate: parseFloat(formState.exchangeRate),
        // ... mas sobreescrituras
    },
    ...
};

// DESPUES (corregido):
return {
    cuadre,  // valores directos del memo (usa datos de BD)
    ...
};
```

**Archivo 2: `src/components/encargada/CuadreGeneralEncargada.tsx`**

Agregar los campos de texto faltantes al objeto `inputsForTotals` (lineas 188-197) para que se guarden con ambos botones:

```typescript
const inputsForTotals = {
    exchangeRateInput,
    cashAvailableInput,
    cashAvailableUsdInput,
    pendingPrizesInput,
    pendingPrizesUsdInput,
    additionalAmountBsInput,
    additionalAmountUsdInput,
    applyExcessUsdSwitch,
    closureNotesInput,        // NUEVO
    additionalNotesInput,     // NUEVO
};
```

### Impacto

- Todos los campos editados por la encargada (efectivo, tasa, premios pendientes, observaciones, ajustes) se guardaran correctamente con ambos botones
- Al recargar o volver a iniciar sesion, los valores guardados se mostraran sin ser reemplazados por los datos de la taquillera
- El calculo del balance final sera consistente antes y despues de guardar

