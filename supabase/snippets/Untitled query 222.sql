-- Decisión: tabla compromisos para agenda (as-is S.compromisos) y para
-- "próximo compromiso" en listado de Prospectos y tarjetas del Funnel.
-- Alternativa descartada: columna jsonb en prospectos — no sirve para agenda
-- global, filtros por responsable/fecha ni compromisos sin prospecto.
--
-- Tipos como CHECK (lista fija del as-is TIPOS), no catálogo: el negocio los
-- trata como enum de UI; si más adelante se editan sin deploy, migrar a tabla.
--
-- Solo esquema. Sin seed ni API de alta en este hito: la UI de /compromisos
-- sigue placeholder; el listado muestra "Sin compromiso" hasta que haya filas.

begin;

create table if not exists public.compromisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null,
  fecha date not null,
  prospecto_id uuid references public.prospectos (id) on delete set null,
  hecho boolean not null default false,
  hecho_en date,
  notas text not null default '',
  -- true = creada/asignada por supervisor al comercial (as-is asignado).
  asignado boolean not null default false,
  responsable_id uuid references public.profiles (id) on delete set null,
  creado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint compromisos_titulo_no_vacio check (length(trim(titulo)) > 0),
  constraint compromisos_tipo_check check (
    tipo in (
      'Llamada',
      'Visita',
      'WhatsApp',
      'Correo',
      'Enviar muestra',
      'Degustación',
      'Enviar cotización',
      'Seguimiento',
      'Cobro',
      'Otro'
    )
  ),
  constraint compromisos_notas_len check (char_length(notas) <= 4000)
);

comment on table public.compromisos is
  'Agenda de seguimientos (as-is compromisos). Esquema listo; alta UI en hito Compromisos.';
comment on column public.compromisos.titulo is
  'Qué hay que hacer (as-is titulo).';
comment on column public.compromisos.tipo is
  'Tipo de actividad; enum alineado al as-is TIPOS.';
comment on column public.compromisos.fecha is
  'Fecha límite (as-is fecha), calendario America/Bogota.';
comment on column public.compromisos.prospecto_id is
  'Prospecto vinculado; null = tarea general sin cliente (as-is prospectoId vacío).';
comment on column public.compromisos.hecho is
  'true = cumplido (as-is hecho).';
comment on column public.compromisos.hecho_en is
  'Día en que se marcó hecho (as-is hechoEn).';
comment on column public.compromisos.asignado is
  'true si el supervisor la asignó (as-is asignado).';
comment on column public.compromisos.responsable_id is
  'Quién lo hace; null hereda lógica de app (as-is responsable / creadoPor).';

-- nextComp(pid): pendientes del prospecto ordenados por fecha.
create index if not exists compromisos_proximo_idx
  on public.compromisos (prospecto_id, fecha)
  where hecho = false and prospecto_id is not null;

-- Agenda por responsable / vencidos.
create index if not exists compromisos_responsable_fecha_idx
  on public.compromisos (responsable_id, fecha)
  where hecho = false;

create index if not exists compromisos_fecha_idx
  on public.compromisos (fecha);

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
