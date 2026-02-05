

# Plan: Cierre de Sesión por Inactividad de 7 Horas

## Resumen

Implementar un sistema que cierre la sesión automáticamente solo si el usuario ha estado inactivo (sin interacción con la página) durante 7 horas. Mientras el usuario esté activo, la sesión se mantiene indefinidamente.

## Cómo Funcionará

1. Cada vez que el usuario interactúa (clicks, teclado, movimiento del mouse, scroll), se reinicia un temporizador de 7 horas
2. Si pasan 7 horas sin ninguna interacción, se ejecuta `signOut()` automáticamente
3. El temporizador se guarda en `localStorage` para persistir entre recargas de página

## Implementación Técnica

### Archivo Nuevo: `src/hooks/useInactivityTimeout.ts`

Hook personalizado que:
- Escucha eventos de usuario: `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`
- Guarda en `localStorage` el timestamp de la última actividad
- Cada minuto verifica si han pasado 7 horas desde la última actividad
- Si se supera el tiempo, ejecuta `signOut()` y redirige a `/auth`

```text
┌─────────────────────────────────────────────────────┐
│              Usuario Interactúa                     │
│  (click, tecla, mouse, scroll, touch)               │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│    Guardar timestamp en localStorage                │
│    lastActivity = Date.now()                        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│    Verificación cada 60 segundos                    │
│    ¿(now - lastActivity) > 7 horas?                 │
└────────────────────┬────────────────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼ NO              ▼ SÍ
     Continuar         signOut() + redirect
```

### Archivo Modificado: `src/App.tsx`

Agregar el hook `useInactivityTimeout` en el componente principal para que esté activo en toda la aplicación.

## Detalles de Implementación

| Aspecto | Valor |
|---------|-------|
| Tiempo de inactividad | 7 horas (25,200,000 ms) |
| Frecuencia de verificación | 1 minuto |
| Persistencia | localStorage (`lastActivityTimestamp`) |
| Eventos monitoreados | mousemove, mousedown, keydown, scroll, touchstart |

## Beneficios

- La sesión no expira mientras el usuario esté trabajando
- Si olvida cerrar sesión al final del día, se cierra automáticamente después de 7 horas de inactividad
- Funciona incluso si el usuario cierra y reabre el navegador (persiste en localStorage)

