# Manual de Usuario - Sistema de Gestión de Loterías

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Configuración Inicial](#configuración-inicial)
4. [Panel de Administración](#panel-de-administración)
5. [Gestión de Usuarios](#gestión-de-usuarios)
6. [Gestión de Agencias](#gestión-de-agencias)
7. [Gestión de Grupos](#gestión-de-grupos)
8. [Gestión de Sistemas](#gestión-de-sistemas)
9. [Reportes y Cuadres](#reportes-y-cuadres)
10. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

Este manual está diseñado para ayudarte a utilizar el **Sistema de Gestión de Loterías**. El sistema permite gestionar agencias, usuarios, sistemas de lotería, cuadres diarios y semanales, y generar reportes de ganancias.

### Roles del Sistema

El sistema cuenta con tres tipos de usuarios principales:

- **Administrador**: Acceso completo al sistema, puede gestionar usuarios, agencias, sistemas y ver todos los reportes.
- **Encargada/Encargado**: Gestiona las operaciones diarias de una agencia, aprueba cuadres y gestiona nóminas.
- **Taquillero**: Registra ventas, premios, gastos y realiza cuadres diarios.

---

## Acceso al Sistema

1. Abre tu navegador web (Chrome, Firefox, Edge, Safari).
2. Ingresa la URL del sistema proporcionada por tu administrador.
3. Verás la pantalla de inicio de sesión.
4. Ingresa tu **correo electrónico** y **contraseña**.
5. Haz clic en **"Iniciar Sesión"**.

> **Nota**: Si olvidaste tu contraseña, contacta al administrador del sistema para que la restablezca.

---

## Configuración Inicial

Si eres el primer administrador del sistema, sigue estos pasos en orden para configurar todo correctamente:

### Paso 1: Crear Grupos de Agencias

Los grupos permiten organizar las agencias de manera lógica (por ejemplo, por región o zona).

1. En el menú lateral, haz clic en **"Grupos"**.
2. Haz clic en el botón **"Crear Nuevo Grupo"**.
3. Completa el formulario:
   - **Nombre**: Ingresa un nombre descriptivo (ej: "Zona Norte", "Agencias Centro").
   - **Descripción**: (Opcional) Agrega una descripción del grupo.
4. Haz clic en **"Crear"**.
5. Repite este proceso para todos los grupos que necesites.

### Paso 2: Crear Agencias

Las agencias son los puntos de venta físicos donde se realizan las operaciones.

1. En el menú lateral, haz clic en **"Agencias"**.
2. Haz clic en el botón **"Nueva Agencia"**.
3. Completa el formulario:
   - **Nombre**: Nombre de la agencia (ej: "Agencia Centro", "Agencia Plaza").
   - **Grupo**: Selecciona el grupo al que pertenece esta agencia.
   - **Activo**: Asegúrate de que el switch esté activado (verde).
4. Haz clic en **"Crear"**.
5. Repite este proceso para todas las agencias.

> **Consejo**: Puedes desactivar una agencia temporalmente cambiando el switch "Activo" a inactivo sin eliminarla.

### Paso 3: Crear Sistemas de Lotería

Los sistemas son las diferentes plataformas de lotería que maneja tu negocio (ej: MaxPlay, Sources, Premier, etc.).

1. En el menú lateral, haz clic en **"Sistemas"**.
2. Haz clic en el botón **"Crear Sistema"**.
3. Completa el formulario:
   - **Código**: Código corto del sistema (ej: "MAXPLAY", "SOURCES").
   - **Nombre**: Nombre completo del sistema.
   - **Activo**: Activa el switch si el sistema está en uso.
4. Haz clic en **"Crear"**.
5. Repite para todos los sistemas que manejes.

### Paso 4: Configurar Comisiones por Sistema

Define los porcentajes de comisión que se aplican a cada sistema.

1. En el menú lateral, haz clic en **"Comisiones"**.
2. Selecciona un sistema del menú desplegable.
3. Ingresa el **porcentaje de comisión** (ej: 5.5 para 5.5%).
4. Haz clic en **"Guardar"**.
5. Repite para cada sistema.

### Paso 5: Crear Usuarios

Ahora puedes crear los usuarios que trabajarán en el sistema. **Este es un paso crítico**.

#### Cómo Crear un Usuario

1. En el menú lateral, haz clic en **"Usuarios"**.
2. Haz clic en el botón **"Crear Usuario"** (botón con ícono "+").
3. Completa el formulario con la siguiente información:

   **Campos Obligatorios:**
   - **Email**: Correo electrónico del usuario (debe ser único, no puede estar registrado previamente).
   - **Contraseña**: Mínimo 6 caracteres. Recomendamos usar contraseñas seguras.
   - **Nombre Completo**: Nombre y apellido del usuario.
   - **Rol**: Selecciona uno de los siguientes:
     - **Taquillero**: Para personal que registra ventas y premios.
     - **Encargada/Encargado**: Para supervisores de agencia.
     - **Administrador**: Solo para personal administrativo con acceso completo.

   **Campos Opcionales:**
   - **Agencia**: Si el usuario está asignado a una agencia específica, selecciónala. Si es administrador, puede dejarse sin agencia.
   - **Activo**: Asegúrate de que esté activado (verde) para que el usuario pueda iniciar sesión.

4. Haz clic en **"Crear"**.
5. Verás un mensaje de confirmación: **"Usuario creado correctamente"**.

> **⚠️ Importante**: 
> - El correo electrónico debe ser único. Si intentas crear un usuario con un correo ya registrado, verás el mensaje: "Ese correo ya está registrado. Usa otro correo o edita el usuario existente."
> - La contraseña debe tener al menos 6 caracteres.
> - Los usuarios inactivos no podrán iniciar sesión, pero sus datos se mantienen en el sistema.

#### Editar un Usuario Existente

1. En la tabla de usuarios, localiza el usuario que deseas editar.
2. Haz clic en el botón de **editar** (ícono de lápiz).
3. Modifica los campos que necesites:
   - Puedes cambiar el nombre, rol, agencia asignada y estado activo/inactivo.
   - **Nota**: No puedes cambiar el email ni la contraseña desde aquí (esto requiere acciones adicionales).
4. Haz clic en **"Actualizar"**.

#### Eliminar un Usuario

1. En la tabla de usuarios, localiza el usuario que deseas eliminar.
2. Haz clic en el botón de **eliminar** (ícono de papelera, en rojo).
3. Aparecerá un modal de confirmación preguntando si estás seguro.
4. Revisa el nombre del usuario en el mensaje.
5. Haz clic en **"Eliminar"** para confirmar o **"Cancelar"** para cancelar.

> **⚠️ Advertencia**: Eliminar un usuario es una acción permanente que no se puede deshacer. El usuario será eliminado completamente del sistema, incluyendo su acceso de autenticación.

---

## Panel de Administración

El panel de administración es tu centro de control. Desde aquí puedes acceder a todas las funcionalidades del sistema.

### Navegación

El menú lateral está organizado en tres secciones:

#### 1. General
- **Dashboard**: Vista general del sistema con tarjetas de acceso rápido.

#### 2. Configuración
- **Agencias**: Gestionar agencias.
- **Grupos**: Gestionar grupos de agencias.
- **Clientes**: Gestionar clientes del sistema.
- **Usuarios**: Gestionar usuarios y sus permisos.
- **Sistemas**: Gestionar sistemas de lotería.
- **Comisiones**: Configurar porcentajes de comisión por sistema.

#### 3. Reportes
- **Resumen por Sistemas**: Vista consolidada de todos los sistemas.
- **Resumen Operadoras**: Resumen manual de operadoras.
- **Cuadres**: Ver cuadres diarios de todas las agencias.
- **Cuadre Semanal**: Vista semanal consolidada.
- **Ganancias**: Reportes de ganancias y pérdidas.

### Uso del Menú Lateral

- Haz clic en cualquier opción del menú para navegar a esa sección.
- El menú se puede colapsar haciendo clic en el botón de menú (☰) en la parte superior.
- La opción activa se resalta en color.

---

## Gestión de Usuarios

### Lista de Usuarios

La pantalla de usuarios muestra una tabla con todos los usuarios del sistema. La tabla incluye:

- **Nombre**: Nombre completo del usuario.
- **Rol**: Tipo de usuario (Administrador, Encargado, Taquillero).
- **Agencia**: Agencia asignada (si aplica).
- **Estado**: Activo o Inactivo.
- **Acciones**: Botones para editar o eliminar.

### Filtros y Búsqueda

La tabla muestra todos los usuarios ordenados por fecha de creación (más recientes primero). Puedes usar la función de búsqueda del navegador (Ctrl+F o Cmd+F) para encontrar usuarios específicos.

### Estados de Usuario

- **Activo** (verde): El usuario puede iniciar sesión y usar el sistema.
- **Inactivo** (rojo): El usuario no puede iniciar sesión, pero sus datos se mantienen.

> **Consejo**: En lugar de eliminar usuarios que ya no trabajan, puedes desactivarlos. Esto preserva el historial de operaciones asociadas a ese usuario.

---

## Gestión de Agencias

### Crear una Nueva Agencia

1. Ve a **"Agencias"** en el menú.
2. Haz clic en **"Nueva Agencia"**.
3. Completa:
   - **Nombre**: Nombre único de la agencia.
   - **Grupo**: Selecciona el grupo al que pertenece.
   - **Activo**: Activa para que la agencia esté disponible.
4. Haz clic en **"Crear"**.

### Editar una Agencia

1. En la tabla de agencias, haz clic en el botón de **editar**.
2. Modifica los campos necesarios.
3. Haz clic en **"Actualizar"**.

### Desactivar una Agencia

Puedes desactivar una agencia temporalmente sin eliminarla:

1. Edita la agencia.
2. Cambia el switch **"Activo"** a inactivo.
3. Guarda los cambios.

Las agencias inactivas no aparecerán en los listados para asignación de usuarios, pero sus datos históricos se mantienen.

---

## Gestión de Grupos

Los grupos permiten organizar las agencias de manera lógica.

### Crear un Grupo

1. Ve a **"Grupos"** en el menú.
2. Haz clic en **"Crear Nuevo Grupo"**.
3. Completa:
   - **Nombre**: Nombre del grupo.
   - **Descripción**: Descripción opcional del grupo.
4. Haz clic en **"Crear"**.

### Editar un Grupo

1. En la tabla de grupos, haz clic en **"Editar"**.
2. Modifica el nombre o descripción.
3. Haz clic en **"Actualizar"**.

> **Nota**: Al editar un grupo, las agencias asignadas a ese grupo no se ven afectadas.

---

## Gestión de Sistemas

Los sistemas representan las diferentes plataformas de lotería que maneja tu negocio.

### Crear un Sistema

1. Ve a **"Sistemas"** en el menú.
2. Haz clic en **"Crear Sistema"**.
3. Completa:
   - **Código**: Código corto (ej: "MAXPLAY").
   - **Nombre**: Nombre completo del sistema.
   - **Activo**: Activa si el sistema está en uso.
4. Haz clic en **"Crear"**.

### Configurar Comisiones

1. Ve a **"Comisiones"** en el menú.
2. Selecciona un sistema del menú desplegable.
3. Ingresa el porcentaje de comisión (ej: 5.5 para 5.5%).
4. Haz clic en **"Guardar"**.

> **Importante**: Las comisiones se usan para calcular ganancias en los reportes. Asegúrate de mantenerlas actualizadas.

---

## Reportes y Cuadres

### Cuadres Diarios

Los cuadres diarios muestran el resumen de operaciones de cada agencia por día.

1. Ve a **"Cuadres"** en el menú de Reportes.
2. Selecciona una fecha usando el selector de fecha.
3. Verás una lista de todos los cuadres de ese día.
4. Puedes ver detalles de cada cuadre haciendo clic en él.

### Cuadre Semanal

El cuadre semanal proporciona una vista consolidada de toda la semana.

1. Ve a **"Cuadre Semanal"** en el menú de Reportes.
2. Selecciona el rango de fechas de la semana.
3. Verás un resumen completo con:
   - Ventas y premios por sistema.
   - Gastos operativos.
   - Nóminas.
   - Préstamos entre agencias.
   - Saldos bancarios.

### Resumen por Sistemas

Esta vista muestra un resumen consolidado de todos los sistemas de lotería.

1. Ve a **"Resumen por Sistemas"**.
2. Selecciona el rango de fechas.
3. Verás una tabla con ventas, premios y ganancias por cada sistema.

### Ganancias

El reporte de ganancias muestra las ganancias netas del negocio.

1. Ve a **"Ganancias"** en el menú de Reportes.
2. Selecciona el rango de fechas.
3. Verás un desglose detallado de:
   - Ingresos por ventas.
   - Egresos por premios.
   - Gastos operativos.
   - Ganancias netas.

---

## Solución de Problemas

### No puedo iniciar sesión

1. Verifica que estés usando el correo y contraseña correctos.
2. Asegúrate de que tu usuario esté **activo** (contacta al administrador).
3. Verifica que no haya errores de conexión a internet.
4. Si el problema persiste, contacta al administrador del sistema.

### Error al crear usuario: "Ese correo ya está registrado"

Este error significa que el correo electrónico que intentas usar ya está en uso por otro usuario.

**Soluciones:**
- Usa un correo diferente.
- Si el usuario ya existe, edítalo en lugar de crear uno nuevo.
- Si necesitas eliminar el usuario anterior, elimínalo primero y luego crea el nuevo.

### No veo una agencia en el listado

1. Verifica que la agencia esté **activa**.
2. Verifica que tengas permisos de administrador.
3. Recarga la página (F5 o Ctrl+R).

### Los reportes no muestran datos

1. Verifica que hayas seleccionado el rango de fechas correcto.
2. Asegúrate de que existan cuadres registrados para esas fechas.
3. Verifica que las agencias y sistemas estén activos.

### El botón "Nueva Agencia" no funciona

1. Recarga la página.
2. Verifica que tengas permisos de administrador.
3. Si el problema persiste, contacta al soporte técnico.

### No puedo modificar la descripción de un grupo

1. Asegúrate de estar en modo de edición (haz clic en "Editar").
2. Verifica que el campo de descripción esté visible en el formulario.
3. Si no aparece, contacta al soporte técnico.

---

## Mejores Prácticas

### Seguridad

- **Nunca compartas tu contraseña** con otros usuarios.
- Usa **contraseñas seguras** (mínimo 8 caracteres, con mayúsculas, minúsculas y números).
- **Desactiva usuarios** en lugar de eliminarlos si solo están temporalmente fuera del sistema.
- **Revisa regularmente** la lista de usuarios activos.

### Organización

- **Crea grupos** antes de crear agencias para mantener todo organizado.
- **Asigna nombres descriptivos** a agencias y grupos.
- **Mantén actualizadas** las comisiones de los sistemas.
- **Revisa los reportes semanalmente** para detectar inconsistencias.

### Gestión de Usuarios

- **Crea usuarios** con correos corporativos cuando sea posible.
- **Asigna el rol correcto** a cada usuario (no des permisos de administrador innecesariamente).
- **Asigna agencias** a usuarios encargados y taquilleros.
- **Documenta** quién tiene acceso a qué.

---

## Preguntas Frecuentes (FAQ)

### ¿Puedo cambiar el correo de un usuario después de crearlo?

No directamente desde la interfaz. Si necesitas cambiar el correo, deberás eliminar el usuario y crear uno nuevo con el correo correcto, o contactar al soporte técnico.

### ¿Qué pasa si elimino un usuario por error?

La eliminación es permanente. Si necesitas recuperar los datos, contacta inmediatamente al soporte técnico, ya que pueden existir backups.

### ¿Puedo tener múltiples administradores?

Sí, puedes crear tantos usuarios con rol de administrador como necesites.

### ¿Los usuarios inactivos ocupan espacio?

Los usuarios inactivos mantienen sus datos en el sistema, pero no pueden iniciar sesión. Esto es útil para preservar el historial de operaciones.

### ¿Cómo cambio la contraseña de un usuario?

Actualmente, la contraseña no se puede cambiar desde la interfaz de administración. El usuario debe usar la función de "Olvidé mi contraseña" en la pantalla de inicio de sesión, o contacta al soporte técnico.

### ¿Puedo exportar los reportes?

Actualmente, los reportes se muestran en pantalla. Para exportar, puedes usar la función de impresión del navegador (Ctrl+P) o tomar capturas de pantalla.

---

## Contacto y Soporte

Si encuentras problemas o tienes preguntas que no están cubiertas en este manual:

1. **Revisa la sección de Solución de Problemas** arriba.
2. **Contacta al administrador del sistema**.
3. **Documenta el problema** con capturas de pantalla si es posible.

---

## Glosario de Términos

- **Agencia**: Punto de venta físico donde se realizan operaciones de lotería.
- **Cuadre**: Resumen diario de operaciones (ventas, premios, gastos) de una agencia.
- **Encargada/Encargado**: Supervisor de una agencia con permisos para aprobar cuadres.
- **Sistema**: Plataforma de lotería (ej: MaxPlay, Sources, Premier).
- **Taquillero**: Personal que registra ventas y premios en el sistema.
- **Usuario Activo/Inactivo**: Estado que determina si un usuario puede iniciar sesión.

---

**Última actualización**: 2024

**Versión del Manual**: 1.0

---

*Este manual está diseñado para ayudarte a utilizar el sistema de manera efectiva. Si encuentras errores o tienes sugerencias de mejora, por favor contacta al equipo de desarrollo.*

