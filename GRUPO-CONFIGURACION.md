# Grupo WSD sin autenticación individual
En Vercel → Project → Settings → Environment Variables, configurar:
- SUPABASE_URL: URL del proyecto Supabase
- SUPABASE_SERVICE_ROLE_KEY: clave service_role (SECRETA, solo servidor)
- WSD_GROUP_KEY: clave compartida larga y única elegida por el docente
No incluir estas claves en GitHub ni en JavaScript público. Volver a desplegar tras configurar.

Las tablas ws_reuniones, ws_archivos y el bucket privado ws-bitacoras se crean con sql/grupo-bitacoras.sql. Mantener RLS: el servidor usa service_role y los visitantes no deben tener permisos directos de escritura.

Para consultar reuniones se usa GET /api/grupo sin clave. Para crear, editar, adjuntar y borrar se usa POST /api/grupo con x-wsd-key.