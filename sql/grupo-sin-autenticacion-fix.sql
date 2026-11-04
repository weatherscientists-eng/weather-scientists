-- Ejecutar en Supabase SQL Editor para adaptar las tablas existentes
-- a la API /api/grupo que valida WSD_GROUP_KEY en el servidor.
-- No borra reuniones ni archivos existentes.
begin;
alter table public.ws_reuniones alter column autor drop not null;
alter table public.ws_reuniones alter column autor drop default;
-- Los clientes anónimos y autenticados no pueden escribir directamente.
-- Solo la API del servidor, con service_role, administra bitácoras.
drop policy if exists "integrantes leen reuniones" on public.ws_reuniones;
drop policy if exists "integrantes crean reuniones" on public.ws_reuniones;
drop policy if exists "integrantes editan reuniones" on public.ws_reuniones;
drop policy if exists "integrantes eliminan reuniones" on public.ws_reuniones;
drop policy if exists "integrantes leen archivos" on public.ws_archivos;
drop policy if exists "integrantes agregan archivos" on public.ws_archivos;
drop policy if exists "integrantes eliminan archivos" on public.ws_archivos;
drop policy if exists "ws leer archivos storage" on storage.objects;
drop policy if exists "ws subir archivos storage" on storage.objects;
drop policy if exists "ws eliminar archivos storage" on storage.objects;
alter table public.ws_reuniones enable row level security;
alter table public.ws_archivos enable row level security;
commit;
-- IMPORTANTE: mantener SUPABASE_SERVICE_ROLE_KEY y WSD_GROUP_KEY
-- exclusivamente en las variables de entorno de Vercel.
