
## Diagnóstico (qué está pasando y por qué)
- En la BD (`encargada_cuadre_details`) para **PRUEBA / 2026-01-29** existen registros guardados, pero están guardados con **IDs de sistema PADRE** (ej: `AGENCIAS OR`, `ATENAS`, `GATO`, `EL INMEJORABLE`), no con las **subcategorías** (ej: `AGENCIAS - Figuras`, `AGENCIAS - Loterías`, etc.).
- El formulario **Ventas/Premios (Por Agencias)** “pinta” inputs usando la lista `lotteryOptions`, que **muestra subcategorías** (IDs hijos).  
  Resultado: el GET a `encargada_cuadre_details` trae datos, pero **no matchean los IDs** que el formulario está renderizando → los inputs salen vacíos aunque “en el sistema” haya valores.

Además, hay un punto crítico:
- `CuadreGeneralEncargada` tiene una lógica que **borra y re-inserta** `encargada_cuadre_details` **agrupando al padre** (`systemKey = parent_system_id || id`). Eso puede “convertir” datos de subcategorías a padre y romper el formulario (que espera hijos).

## Objetivo exacto
1) Hacer que el formulario sea un **editor de registros existentes**: al cargar o volver a la pestaña, hace GET y **rellena inputs** con lo que está guardado.  
2) Asegurar que **lo guardado quede guardado en subcategorías**, para que el GET posterior “calce” con los inputs.  
3) Totalizadores deben sumar lo que está en los inputs (subcategorías).

---

## Plan de implementación (cambios concretos)

### 1) “Pintar desde BD” con compatibilidad para datos viejos (guardados en padre)
Archivo: `src/components/encargada/VentasPremiosEncargada.tsx` (función `loadAgencyData`)

**Nuevo comportamiento de merge:**
- Seguimos trayendo `encargada_cuadre_details` por `agency_id + session_date` (sin depender de sesión actual).
- Construimos 2 mapas:
  1) `detailsByExactSystemId`: filas donde `lottery_system_id` coincide con un ID que el formulario está mostrando (subcategorías + sistemas normales).
  2) `detailsByParentIdLegacy`: filas donde `lottery_system_id` NO está en el formulario, pero corresponde a un sistema padre con hijos.

**Regla para legacy (padre → hijos):**
- Si para un padre **no existe ningún hijo guardado**, entonces “pintamos” el valor del padre en **una subcategoría por defecto** (determinística), por ejemplo:
  - Preferir la subcategoría cuyo `code` incluya `-loterias` o cuyo `name` incluya “Loterías”.
  - Si no existe, usar la primera subcategoría del padre.
- Esto hace que **PRUEBA / 29** deje de verse “en blanco” inmediatamente, usando el dato ya guardado (aunque esté en padre).

Importante: esto NO inventa montos, solo reubica visualmente el monto guardado en un input para que el usuario lo vea y pueda editarlo.

### 2) Guardar SIEMPRE en subcategorías (y nunca volver a “colapsar” al padre)
Archivo: `src/components/encargada/VentasPremiosEncargada.tsx` (función `onSubmit`)

**Cambios:**
- Al construir `detailsData`, guardar solo:
  - Sistemas que son subcategorías (tienen `parent_system_id`)  
  - + sistemas standalone (que no tienen hijos)
- Evitar guardar filas “padre” cuando ese padre tiene subcategorías, porque eso es exactamente lo que rompe el pintado.

**Delete correcto antes de insert (fuente única):**
- Cambiar el delete actual:
  - Hoy: borra por `agency_id + session_date + user_id`
  - Propuesto: borra por `agency_id + session_date` (sin user_id), para que exista **una sola versión** por agencia/fecha y evitar duplicados/doble conteo en reportes.
- Insertar después con `user_id = user.id` (sirve como “último editor”), pero la “fuente” es la combinación agencia/fecha.

### 3) Evitar que “Guardar Cuadre General” destruya subcategorías
Archivo: `src/components/encargada/CuadreGeneralEncargada.tsx`

**Cambio clave:**
- El bloque que hoy hace:
  - leer transacciones taquillera
  - consolidar a `systemKey = parent_system_id || id`
  - `delete` en `encargada_cuadre_details`
  - `insert` en `encargada_cuadre_details`
  
  debe dejar de sobrescribir `encargada_cuadre_details`.

**Opciones (elegiré la más segura):**
- Opción A (recomendada): eliminar ese guardado a `encargada_cuadre_details` desde CuadreGeneralEncargada, y que esa tabla sea responsabilidad del módulo Ventas/Premios (Por Agencias).
- Opción B (si necesitas mantenerlo por reportes): solo escribir en `encargada_cuadre_details` si NO existe nada para esa agencia/fecha, y aun así escribir respetando IDs de subcategorías (lo cual requiere la misma estrategia “padre → hijo por defecto”).  
  Por urgencia y riesgo, A es lo más limpio.

Esto evitará que cuando se “guarda todo el cuadre” se pierda el desglose.

### 4) Totalizadores: sumar inputs (subcategorías) de forma consistente
Archivo: `src/components/encargada/VentasPremiosEncargada.tsx`

- Ajustar el cálculo de totales para que sume:
  - subcategorías + standalone
  - y NO considere filas “padre” si por alguna razón existieran en `systems` (defensa extra).

### 5) Verificación puntual con tu caso urgente (PRUEBA / 29)
Checklist de validación (manual):
1. Ir a **Encargada → Por Agencias → Ventas/Premios**, agencia **PRUEBA**, fecha **29 enero**.
2. Confirmar:
   - Los inputs de subcategorías ya NO salen vacíos (si en BD solo existe padre, se verán en la subcategoría “por defecto”).
   - Totalizadores suman esos inputs.
3. Cambiar a otra pestaña (Gastos) y volver:
   - Los valores se mantienen (GET desde BD + reset consistente).
4. Editar un par de subcategorías y Guardar:
   - Recargar página y verificar que vuelven a aparecer (ya guardados como hijos).
   - Verificar que `encargada_cuadre_details` ahora tiene filas en IDs hijos (subcategorías), no en el padre.

---

## Riesgos/Notas
- El cambio de “delete sin user_id” asume el modelo real: **una sola versión por agencia/fecha** (lo que tú estás pidiendo como “fuente única”). Si en tu operación hay más de una encargada editando lo mismo, habría que coordinarlo con “bloqueo” o “última escritura gana”.
- Si el usuario que usa Encargada realmente no tiene rol/permiso, el delete global podría fallar por RLS. En ese caso, agregaré fallback (si delete global falla, borrar solo por `user_id`) y log/alert claro. Pero primero implementaría el flujo correcto.

---

## Qué cambiaré exactamente (resumen técnico)
- `VentasPremiosEncargada.tsx`
  - `loadAgencyData`: merge inteligente + fallback padre→hijo si no hay hijos guardados.
  - `onSubmit`: guardar en subcategorías; delete por agencia/fecha; recarga post-save.
  - Totales: sumar solo inputs.
- `CuadreGeneralEncargada.tsx`
  - Quitar o neutralizar el overwrite de `encargada_cuadre_details` que colapsa subcategorías.

Si apruebas, implemento estos cambios de inmediato y validamos con PRUEBA/29.
