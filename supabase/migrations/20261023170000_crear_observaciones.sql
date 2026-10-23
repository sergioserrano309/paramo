-- Decisión: `observaciones` como tabla propia: el supervisor deja una observación (sobre un
-- prospecto o de gestión general) y el comercial la atiende con una respuesta. Tiene su
-- propio ciclo de vida (abierta → atendida) y se consulta por estado, así que no cabe
-- como columna de otra tabla (AGENTS.md §3.2). En el as-is eran documentos sueltos.
--
-- prospecto_id es `on delete set null`: la observación y su respuesta sobreviven al
-- prospecto. Sin INSERT de datos.

begin;

create table if not exists public.observaciones (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid references public.prospectos (id) on delete set null,
  texto text not null,
  estado text not null default 'abierta',
  autor_id uuid references public.profiles (id) on delete set null,
  respuesta text not null default '',
  atendida_en timestamptz,
  atendida_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint observaciones_texto_no_vacio check (length(trim(texto)) > 0),
  constraint observaciones_estado_check check (estado in ('abierta', 'atendida')),
  constraint observaciones_atendida_coherente
    check ((estado = 'atendida') = (atendida_en is not null))
);

comment on table public.observaciones is
  'Observaciones del supervisor para el comercial (as-is observaciones).';
comment on column public.observaciones.prospecto_id is
  'Prospecto al que se refiere; null = gestión general.';
comment on column public.observaciones.autor_id is
  'Quien la escribió (as-is autor); solo él puede retirarla mientras esté abierta.';
comment on column public.observaciones.respuesta is
  'Qué hizo el comercial al atenderla (opcional).';

-- Dashboard del comercial y Supervisión: abiertas primero, más recientes arriba.
create index if not exists observaciones_estado_creado_idx
  on public.observaciones (estado, creado_en desc);
-- Observaciones abiertas de un prospecto (insignia en «Cartera bajo seguimiento»).
create index if not exists observaciones_prospecto_abierta_idx
  on public.observaciones (prospecto_id)
  where prospecto_id is not null and estado = 'abierta';

alter table public.observaciones enable row level security;
revoke all on public.observaciones from anon, authenticated;

commit;
