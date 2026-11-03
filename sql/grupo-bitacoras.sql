-- Ejecutar una vez en Supabase SQL Editor.
create table if not exists public.ws_integrantes (user_id uuid primary key references auth.users(id) on delete cascade, nombre text not null, creado_en timestamptz default now());
create table if not exists public.ws_reuniones (
 id uuid primary key default gen_random_uuid(), fecha date not null, titulo text not null,
 lugar text, objetivo text, participantes text, actividades text, resultados text,
 dificultades text, compromisos text, proxima_reunion date,
 autor uuid not null default auth.uid() references auth.users(id),
 creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table if not exists public.ws_archivos (
 id uuid primary key default gen_random_uuid(), reunion_id uuid not null references public.ws_reuniones(id) on delete cascade,
 ruta text not null, nombre text not null, creado_en timestamptz default now()
);
alter table public.ws_integrantes enable row level security;
alter table public.ws_reuniones enable row level security;
alter table public.ws_archivos enable row level security;
create or replace function public.ws_es_integrante() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.ws_integrantes where user_id=auth.uid())$$;
revoke all on function public.ws_es_integrante() from public;
grant execute on function public.ws_es_integrante() to authenticated;
create policy "integrantes leen integrantes" on public.ws_integrantes for select to authenticated using (public.ws_es_integrante());
create policy "integrantes leen reuniones" on public.ws_reuniones for select to authenticated using (public.ws_es_integrante());
create policy "integrantes crean reuniones" on public.ws_reuniones for insert to authenticated with check (public.ws_es_integrante() and autor=auth.uid());
create policy "integrantes editan reuniones" on public.ws_reuniones for update to authenticated using (public.ws_es_integrante()) with check (public.ws_es_integrante());
create policy "integrantes eliminan reuniones" on public.ws_reuniones for delete to authenticated using (public.ws_es_integrante());
create policy "integrantes leen archivos" on public.ws_archivos for select to authenticated using (public.ws_es_integrante());
create policy "integrantes agregan archivos" on public.ws_archivos for insert to authenticated with check (public.ws_es_integrante());
create policy "integrantes eliminan archivos" on public.ws_archivos for delete to authenticated using (public.ws_es_integrante());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('ws-bitacoras','ws-bitacoras',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "ws leer archivos storage" on storage.objects for select to authenticated using(bucket_id='ws-bitacoras' and public.ws_es_integrante());
create policy "ws subir archivos storage" on storage.objects for insert to authenticated with check(bucket_id='ws-bitacoras' and public.ws_es_integrante());
create policy "ws eliminar archivos storage" on storage.objects for delete to authenticated using(bucket_id='ws-bitacoras' and public.ws_es_integrante());
-- Después de crear las cuentas en Authentication, incorporar cada UUID:
-- insert into public.ws_integrantes(user_id,nombre) values ('UUID-DE-AUTH-USERS','Nombre integrante');
