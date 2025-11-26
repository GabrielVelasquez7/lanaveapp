# MaxPlayGo / SOURCES Sync (Deshabilitado)

Este directorio documentaba el sistema de scraping/sincronización con MaxPlayGo y otras fuentes externas.

Actualmente **toda la funcionalidad de sync automático ha sido deshabilitada** y los scripts/funciones que contenían
credenciales o llaves sensibles han sido eliminados del proyecto por motivos de seguridad.

Si en el futuro quieres reactivar algún tipo de integración externa, será necesario:

1. Diseñar una nueva arquitectura de sync.
2. Usar SIEMPRE variables de entorno/secretos (nunca credenciales en código).
3. Revisar con cuidado permisos y llaves de servicio en Supabase antes de desplegar.
