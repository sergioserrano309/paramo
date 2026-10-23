-- Decisión: la ficha del prospecto necesita dos cosas que una columna
-- suelta no cubre igual.
--
-- actividad (jsonb en prospectos): es el historial de la ficha (as-is
-- p.actividad). Es una lista ordenada del mismo registro, no se filtra
-- sola en otras pantallas. Una tabla nueva no aportaba.
--
-- observaciones: sí es tabla. Cada nota tiene estado, respuesta y autor,
-- y el comercial atiende una sin reescribir el prospecto. Está en el
-- inventario canónico del proyecto.
--
-- Sin seed. La bitácora global sigue sin escritura: el historial de la
-- ficha no la reemplaza.

begin;

alter table public.prospectos
  add column if not exists actividad jsonb not null default '[]'::jsonb;

comment on column public.prospectos.actividad is
  'Historial de la ficha (as-is actividad): [{f,t,x,u}]. No incluye hechos anteriores al alta de la columna.';

create table if not exists public.observaciones (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null
    references public.prospectos (id) on delete cascade,
  texto text not null,
  estado text not null default 'abierta',
  respuesta text not null default '',
  autor_id uuid references public.profiles (id) on delete set null,
  atendida_por uuid references public.profiles (id) on delete set null,
  atendida_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint observaciones_texto_no_vacio check (length(trim(texto)) > 0),
  constraint observaciones_texto_len check (char_length(texto) <= 2000),
  constraint observaciones_respuesta_len check (char_length(respuesta) <= 2000),
  constraint observaciones_estado_check check (estado in ('abierta', 'atendida'))
);

comment on table public.observaciones is
  'Observaciones del supervisor sobre un prospecto (as-is observaciones).';
comment on column public.observaciones.texto is
  'Qué vio el supervisor y qué espera del comercial.';
comment on column public.observaciones.estado is
  'abierta o atendida.';
comment on column public.observaciones.respuesta is
  'Qué hizo el comercial al marcarla atendida. Vacío si no contestó.';
comment on column public.observaciones.autor_id is
  'Supervisor que la dejó. Solo él puede retirarla mientras está abierta.';

create index if not exists observaciones_prospecto_idx
  on public.observaciones (prospecto_id, creado_en desc);

alter table public.observaciones enable row level security;
revoke all on public.observaciones from anon, authenticated;

commit;
