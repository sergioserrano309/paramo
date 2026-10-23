-- Decisión: `productos` como tabla propia (es una entidad del dominio con ciclo de vida
-- y la usarán cotizaciones y ventas por FK).
--
-- Precios por tipo de cliente: se guardan en dos columnas jsonb de la misma fila
--   precios            -> en firme  { "<tipo_cliente.codigo>": { "modo": "pct"|"precio", "v": n } }
--   precios_pendientes -> propuestos por el comercial, a la espera del supervisor
--                         { "<codigo>": { "modo": "pct"|"precio"|null, "v": n, "por": uuid, "en": ts } }
-- Alternativa descartada: tabla `productos_precios` (producto, tipo, modo, valor, estado).
-- Daría integridad referencial con tipos_cliente, pero AGENTS.md §3.2 pide agotar primero
-- columna / jsonb; son ~21–100 productos y x5 tipos, así que el volumen no lo justifica.
-- La validez del contenido (códigos existentes, rangos) se valida en la API con zod.
--
-- Nombre único (sin distinguir mayúsculas ni espacios en los bordes): el as-is rechaza
-- duplicados («Ya existe un producto con ese nombre») y ventas cruza por nombre.
-- Limitación conocida: no ignora tildes (eso exigiría la extensión unaccent).
--
-- Línea y estado: CHECK en la base (valores canónicos del as-is LINEAS / ESTADOS) en vez
-- de tablas de catálogo, para no crear dos tablas de 4 filas que casi nunca cambian.
--
-- Sin retroalimentación ni «prospectos interesados» todavía: en el as-is viven dentro del
-- documento del producto; se resolverán cuando se construyan esas piezas.
--
-- Sin INSERT de datos: el catálogo inicial vive en supabase/seed/003_productos.sql.

begin;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sku text not null default '',
  linea text not null default 'frutas',
  presentacion text not null default '',
  estado text not null default 'desarrollo',
  precio_publico numeric(12, 0) not null default 0,
  lanzamiento date,
  descripcion text not null default '',
  precios jsonb not null default '{}'::jsonb,
  precios_pendientes jsonb not null default '{}'::jsonb,
  creado_por uuid references public.profiles (id) on delete set null,
  actualizado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint productos_nombre_no_vacio check (length(trim(nombre)) > 0),
  constraint productos_linea_check
    check (linea in ('frutas', 'vegetales', 'packs', 'otra')),
  constraint productos_estado_check
    check (estado in ('desarrollo', 'lanzamiento', 'activo', 'descontinuado')),
  constraint productos_precio_publico_check check (precio_publico >= 0),
  constraint productos_precios_objeto check (jsonb_typeof(precios) = 'object'),
  constraint productos_precios_pend_objeto
    check (jsonb_typeof(precios_pendientes) = 'object')
);

comment on table public.productos is
  'Catálogo de referencias de Páramo Snacks (as-is productos).';
comment on column public.productos.nombre is
  'Nombre comercial. Único sin distinguir mayúsculas; ventas cruza por este nombre.';
comment on column public.productos.sku is
  'Código interno opcional.';
comment on column public.productos.linea is
  'frutas | vegetales | packs | otra (as-is LINEAS).';
comment on column public.productos.estado is
  'desarrollo | lanzamiento | activo | descontinuado (as-is ESTADOS).';
comment on column public.productos.precio_publico is
  'PVP en COP antes de descuentos por tipo de cliente (as-is precioPublico).';
comment on column public.productos.precios is
  'Precio en firme por tipo_cliente.codigo: {modo: pct|precio, v}. pct = % bajo el PVP.';
comment on column public.productos.precios_pendientes is
  'Precio propuesto por el comercial por tipo_cliente.codigo, pendiente de aprobación: {modo, v, por, en}. modo null = propone quitar el precio especial.';

-- Listado del módulo: filtro por estado y orden por estado/nombre.
create index if not exists productos_estado_idx on public.productos (estado);

-- Unicidad y búsqueda exacta por nombre normalizado.
create unique index if not exists productos_nombre_lower_key
  on public.productos (lower(btrim(nombre)));

alter table public.productos enable row level security;
revoke all on public.productos from anon, authenticated;

create or replace function public.set_productos_actualizado_en()
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

revoke all on function public.set_productos_actualizado_en()
  from public, anon, authenticated;

drop trigger if exists productos_set_actualizado_en on public.productos;
create trigger productos_set_actualizado_en
  before update on public.productos
  for each row
  execute function public.set_productos_actualizado_en();

-- Aclaración: este porcentaje es la lista general editable por el supervisor (as-is
-- precioCfg), no solo un valor inicial. Las cotizaciones lo usan cuando el producto no
-- tiene precio especial para el tipo de cliente.
comment on column public.tipos_cliente.descuento_pct_default is
  'Lista general: % de descuento sobre el PVP para este tipo de cliente. Editable por el supervisor; se usa cuando el producto no tiene precio especial.';

commit;
