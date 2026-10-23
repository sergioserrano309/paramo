-- Decisión: `compromisos` (agenda comercial) como tabla propia, con el responsable como FK
-- obligatoria a `profiles`. El as-is dejaba `responsable` vacío cuando la tarea no estaba
-- asignada y la atribuía «al vendedor» en el código (vendorId); aquí el responsable siempre
-- existe, así los filtros y el seguimiento por persona se resuelven en SQL.
--
-- `asignado` conserva la marca «Asignada por supervisor» del as-is: no se deduce de
-- responsable != creado_por porque el supervisor puede reasignar una tarea ya existente.
--
-- Tipos de compromiso: CHECK en la base (valores del as-is TIPOS), no tabla de catálogo.
-- prospecto_id es `on delete set null`: el compromiso (y su cumplimiento) sobrevive a un
-- prospecto eliminado.
--
-- Sin INSERT de datos de negocio.

begin;

create table if not exists public.compromisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'Llamada',
  fecha date not null,
  prospecto_id uuid references public.prospectos (id) on delete set null,
  notas text not null default '',
  hecho boolean not null default false,
  hecho_en date,
  responsable_id uuid not null references public.profiles (id) on delete restrict,
  asignado boolean not null default false,
  creado_por uuid references public.profiles (id) on delete set null,
  actualizado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint compromisos_titulo_no_vacio check (length(trim(titulo)) > 0),
  constraint compromisos_tipo_check check (
    tipo in (
      'Llamada', 'Visita', 'WhatsApp', 'Correo', 'Enviar muestra',
      'Degustación', 'Enviar cotización', 'Seguimiento', 'Cobro', 'Otro'
    )
  ),
  constraint compromisos_hecho_en_coherente check (hecho or hecho_en is null)
);

comment on table public.compromisos is
  'Agenda comercial: llamadas, visitas, muestras, cotizaciones pendientes (as-is compromisos).';
comment on column public.compromisos.fecha is
  'Fecha límite (día calendario, America/Bogota).';
comment on column public.compromisos.hecho_en is
  'Día en que se marcó hecho; si es posterior a `fecha` cuenta como «tarde».';
comment on column public.compromisos.responsable_id is
  'Quién debe cumplirlo (as-is responsable / respC).';
comment on column public.compromisos.asignado is
  'true = lo asignó un supervisor a otra persona («Asignada por supervisor»).';

-- Agenda por persona: pendientes por responsable y fecha.
create index if not exists compromisos_responsable_pendiente_idx
  on public.compromisos (responsable_id, fecha)
  where not hecho;
-- Cumplimiento de los últimos 30 días y filtros por fecha.
create index if not exists compromisos_fecha_idx on public.compromisos (fecha);
-- Compromisos de un prospecto (ficha del prospecto / tarjeta del funnel).
create index if not exists compromisos_prospecto_idx
  on public.compromisos (prospecto_id)
  where prospecto_id is not null;

alter table public.compromisos enable row level security;
revoke all on public.compromisos from anon, authenticated;

create or replace function public.set_compromisos_actualizado_en()
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

revoke all on function public.set_compromisos_actualizado_en()
  from public, anon, authenticated;

drop trigger if exists compromisos_set_actualizado_en on public.compromisos;
create trigger compromisos_set_actualizado_en
  before update on public.compromisos
  for each row
  execute function public.set_compromisos_actualizado_en();

commit;
