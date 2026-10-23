-- Decisión: `cotizaciones` como una sola tabla; las líneas viajan en `items jsonb` y la
-- aprobación / rechazo del descuento en `aprobacion` / `rechazo` jsonb.
-- Alternativa descartada: tabla `cotizacion_items`. Las líneas se leen y escriben siempre
-- junto con la cotización, son un snapshot (nombre, presentación y precio al momento de
-- cotizar, no se actualizan si el producto cambia) y nadie consulta por producto desde
-- SQL; una tabla hija solo añadiría joins (AGENTS.md §3.2).
--
-- Numeración COT-AAAA-NNN: la asigna un trigger BEFORE INSERT bajo advisory lock. El as-is
-- calcula «máximo + 1» en el navegador, y dos comerciales a la vez obtenían el mismo
-- número. El año se toma en hora de Bogotá. UNIQUE(numero) queda como red de seguridad.
-- Como el as-is, borrar la última cotización libera su número (max + 1).
--
-- `total` es derivado (subtotal − descuento + IVA) y lo recalcula la API en cada guardado.
-- Se guarda para que Dashboard y los KPI sumen en SQL sin recorrer el jsonb.
--
-- prospecto_id es `on delete set null` con `cliente_nombre` como snapshot: la cotización
-- (y el PDF ya enviado al cliente) debe sobrevivir si el prospecto se elimina.
--
-- Sin INSERT de datos de negocio.

begin;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  version integer not null default 0,
  prospecto_id uuid references public.prospectos (id) on delete set null,
  cliente_nombre text not null default '',
  tipo_cliente_codigo text references public.tipos_cliente (codigo) on delete set null,
  fecha date not null default (timezone('America/Bogota', now()))::date,
  validez_dias integer not null default 15,
  pago text not null default 'Crédito 30 días',
  entrega text not null default '',
  notas text not null default '',
  items jsonb not null default '[]'::jsonb,
  desc_pct numeric(4, 1) not null default 0,
  iva_pct smallint not null default 19,
  total numeric(14, 0) not null default 0,
  estado text not null default 'borrador',
  desc_solicitado numeric(4, 1),
  solicitado_en timestamptz,
  aprobacion jsonb,
  rechazo jsonb,
  final_en timestamptz,
  enviada_en timestamptz,
  cerrada_en timestamptz,
  creado_por uuid references public.profiles (id) on delete set null,
  actualizado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cotizaciones_numero_key unique (numero),
  constraint cotizaciones_estado_check check (
    estado in (
      'borrador', 'pendiente', 'rechazada', 'final',
      'enviada', 'aceptada', 'no_aceptada'
    )
  ),
  constraint cotizaciones_pago_check check (
    pago in ('Contado', 'Crédito 15 días', 'Crédito 30 días', 'Crédito 60 días')
  ),
  constraint cotizaciones_desc_check check (desc_pct >= 0 and desc_pct <= 60),
  constraint cotizaciones_iva_check check (iva_pct in (0, 19)),
  constraint cotizaciones_validez_check check (validez_dias >= 1),
  constraint cotizaciones_total_check check (total >= 0),
  constraint cotizaciones_items_array check (jsonb_typeof(items) = 'array'),
  constraint cotizaciones_aprobacion_objeto
    check (aprobacion is null or jsonb_typeof(aprobacion) = 'object'),
  constraint cotizaciones_rechazo_objeto
    check (rechazo is null or jsonb_typeof(rechazo) = 'object')
);

comment on table public.cotizaciones is
  'Cotizaciones a prospectos/clientes (as-is cotizaciones). Líneas en items jsonb.';
comment on column public.cotizaciones.numero is
  'COT-AAAA-NNN. Lo asigna el trigger al insertar; la API no lo envía.';
comment on column public.cotizaciones.version is
  'Sube cada vez que se genera la versión final (o se aprueba el descuento).';
comment on column public.cotizaciones.cliente_nombre is
  'Snapshot del nombre del cliente al cotizar.';
comment on column public.cotizaciones.tipo_cliente_codigo is
  'Define qué precio por tipo de cliente se usa en las líneas.';
comment on column public.cotizaciones.items is
  'Líneas: [{producto_id, nombre, presentacion, caja, cant, precio}]. Snapshot de precio.';
comment on column public.cotizaciones.desc_pct is
  'Descuento global %. Mayor a 5 requiere aprobación del supervisor (config/cotizaciones.ts).';
comment on column public.cotizaciones.total is
  'Derivado: base + IVA. Recalculado por la API en cada guardado.';
comment on column public.cotizaciones.estado is
  'borrador | pendiente (espera aprobar descuento) | rechazada | final | enviada | aceptada | no_aceptada.';
comment on column public.cotizaciones.desc_solicitado is
  'Descuento que pidió el comercial cuando pasó a pendiente.';
comment on column public.cotizaciones.aprobacion is
  '{por, en, desc, solicitado, comentario} del descuento aprobado.';
comment on column public.cotizaciones.rechazo is
  '{por, en, solicitado, comentario} del descuento rechazado.';

-- Listado: filtro por estado y orden por número / fecha.
create index if not exists cotizaciones_estado_idx on public.cotizaciones (estado);
create index if not exists cotizaciones_fecha_idx on public.cotizaciones (fecha desc);
-- Cotizaciones de un prospecto (ficha del prospecto, efecto al aceptar/enviar).
create index if not exists cotizaciones_prospecto_idx
  on public.cotizaciones (prospecto_id)
  where prospecto_id is not null;

alter table public.cotizaciones enable row level security;
revoke all on public.cotizaciones from anon, authenticated;

create or replace function public.asignar_numero_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  anio text;
  siguiente integer;
begin
  anio := to_char(timezone('America/Bogota', now()), 'YYYY');
  -- Serializa las altas del mismo año hasta el fin de la transacción.
  perform pg_advisory_xact_lock(hashtext('cotizaciones_numero_' || anio));
  select coalesce(max(substring(numero from '(\d+)$')::integer), 0) + 1
    into siguiente
    from public.cotizaciones
    where numero like 'COT-' || anio || '-%';
  new.numero := 'COT-' || anio || '-' || lpad(siguiente::text, 3, '0');
  return new;
end;
$$;

revoke all on function public.asignar_numero_cotizacion()
  from public, anon, authenticated;

drop trigger if exists cotizaciones_asignar_numero on public.cotizaciones;
create trigger cotizaciones_asignar_numero
  before insert on public.cotizaciones
  for each row
  execute function public.asignar_numero_cotizacion();

create or replace function public.set_cotizaciones_actualizado_en()
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

revoke all on function public.set_cotizaciones_actualizado_en()
  from public, anon, authenticated;

drop trigger if exists cotizaciones_set_actualizado_en on public.cotizaciones;
create trigger cotizaciones_set_actualizado_en
  before update on public.cotizaciones
  for each row
  execute function public.set_cotizaciones_actualizado_en();

-- Tipo de cliente por defecto de cada canal (as-is CANAL_TIPO): cuando el prospecto no
-- tiene tipo de cliente propio, la cotización usa el del canal. Es una columna en el
-- catálogo existente, no una tabla ni una constante en el código; los valores iniciales
-- van en supabase/seed/004_canal_tipo_cliente.sql.
alter table public.canales
  add column if not exists tipo_cliente_codigo text
    references public.tipos_cliente (codigo) on delete set null;

comment on column public.canales.tipo_cliente_codigo is
  'Tipo de cliente que se asume para prospectos de este canal al cotizar (as-is CANAL_TIPO).';

commit;
