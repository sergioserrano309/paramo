-- Decisión: profiles es la tabla de autorización de la app (rol de negocio + activo).
-- Supabase Auth solo resuelve identidad; el rol no se confía solo en claims del JWT.
-- Se usa trigger en auth.users para crear el perfil al registrar un usuario
-- (default comercial); el rol supervisor se asigna después en la base o por un
-- flujo admin futuro. Alternativa descartada: crear el perfil solo desde la API
-- en el primer login — deja ventanas donde hay sesión sin fila de autorización.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol text not null default 'comercial',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint profiles_rol_check check (rol in ('comercial', 'supervisor'))
);

comment on table public.profiles is
  'Usuario de negocio del CRM. Un registro por auth.users; define rol y activo.';
comment on column public.profiles.id is
  'Mismo UUID que auth.users.id.';
comment on column public.profiles.email is
  'Copia del email de Auth para listados operativos sin consultar auth.users.';
comment on column public.profiles.nombre is
  'Nombre visible en el shell y bitácora.';
comment on column public.profiles.rol is
  'Rol canónico: comercial | supervisor.';
comment on column public.profiles.activo is
  'Si es false, la app niega el acceso aunque la sesión de Auth sea válida.';

-- Consulta típica: cargar el perfil del usuario autenticado por id.
create index if not exists profiles_rol_idx on public.profiles (rol);
create index if not exists profiles_activo_idx on public.profiles (activo)
  where activo = true;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

create or replace function public.set_profiles_actualizado_en()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

revoke all on function public.set_profiles_actualizado_en() from public, anon, authenticated;

drop trigger if exists profiles_set_actualizado_en on public.profiles;
create trigger profiles_set_actualizado_en
  before update on public.profiles
  for each row
  execute function public.set_profiles_actualizado_en();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    'comercial',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea profiles al insertar en auth.users. Default rol=comercial.';

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

commit;
