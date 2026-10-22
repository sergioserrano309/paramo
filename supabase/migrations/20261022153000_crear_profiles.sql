-- Decisión: profiles es la tabla de autorización de la app (rol de negocio + activo).
-- Supabase Auth solo resuelve identidad; el rol no se confía solo en claims del JWT.
-- Alta operativa: API /api/usuarios (solo supervisor) crea auth.users + profiles
-- en el mismo flujo. Alternativa descartada: trigger en auth.users que asigne
-- rol al registrarse — mezcla esquema con negocio y crea perfil ante cualquier
-- alta en Auth. Sin fila en profiles, la app niega el acceso (fail closed).
-- Bootstrap del primer supervisor: supabase/local/ (solo máquina local).
-- Mock compartido del equipo: supabase/seed/ (versionado; aplicar a mano).

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol text not null,
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
  'Rol canónico: comercial | supervisor. Obligatorio en el INSERT; sin default.';
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

commit;
