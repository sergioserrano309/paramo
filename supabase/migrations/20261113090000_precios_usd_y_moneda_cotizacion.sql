-- Decisión: los clientes pueden cotizarse en COP o en USD. Se resuelve con columnas nuevas
-- en tablas existentes (AGENTS.md §3.2), sin tablas nuevas:
--   productos.precio_publico_usd  -> PVP en dólares, al lado del PVP en COP.
--   cotizaciones.moneda           -> 'COP' | 'USD'; fija la moneda de todas las líneas.
-- Alternativa descartada: guardar una tasa de cambio y convertir. El negocio define el
-- precio en cada moneda; convertir automáticamente exigiría mantener una TRM.
--
-- Los precios por tipo de cliente (% sobre PVP) no se duplican: el mismo % se aplica al PVP
-- de la moneda de la cotización. Un «precio fijo» está en COP y no tiene equivalente en USD,
-- así que en USD cae a la lista general (lo resuelve la app, lib/precios.ts).
--
-- Un producto puede tener solo uno de los dos PVP (0 = sin precio en esa moneda); que al
-- menos uno sea > 0 lo valida la API al crear/editar, no la base (los productos creados por
-- la carga de ventas nacen con PVP 0 en ambas monedas, como hoy).
--
-- cotizaciones.total pasa a 2 decimales: en USD hay centavos y con numeric(14,0) se
-- redondeaban al dólar. Ampliar la escala no altera los totales COP ya guardados.
--
-- Cambio manual de precio en cotización: cada línea de items guarda `precio` (el cotizado)
-- y `precio_lista` (el del catálogo al cotizar), así que el historial de cambios por
-- producto se deriva de las cotizaciones sin tabla de historial. Esos campos viven dentro
-- del jsonb `items` y no requieren cambio de esquema. Lo aprobado por el supervisor se
-- guarda dentro de `aprobacion` (campo `precios`), tampoco requiere columna.
--
-- Sin INSERT de datos de negocio.

begin;

alter table public.productos
  add column if not exists precio_publico_usd numeric(12, 2) not null default 0;

alter table public.productos drop constraint if exists productos_precio_publico_usd_check;
alter table public.productos
  add constraint productos_precio_publico_usd_check check (precio_publico_usd >= 0);

comment on column public.productos.precio_publico_usd is
  'PVP en USD (0 = sin precio en dólares). Los precios por tipo de cliente aplican su % sobre este valor al cotizar en USD.';
comment on column public.productos.precio_publico is
  'PVP en COP antes de descuentos por tipo de cliente (as-is precioPublico); 0 = sin precio en pesos.';

alter table public.cotizaciones
  add column if not exists moneda text not null default 'COP';

alter table public.cotizaciones drop constraint if exists cotizaciones_moneda_check;
alter table public.cotizaciones
  add constraint cotizaciones_moneda_check check (moneda in ('COP', 'USD'));

comment on column public.cotizaciones.moneda is
  'Moneda de la cotización (COP | USD): aplica a precios de las líneas, subtotal y total.';

alter table public.cotizaciones
  alter column total type numeric(14, 2);

comment on column public.cotizaciones.total is
  'Derivado: base + IVA, en la moneda de la cotización. Recalculado por la API en cada guardado.';
comment on column public.cotizaciones.items is
  'Líneas: [{producto_id, nombre, presentacion, caja, cant, precio, precio_lista}]. Snapshot de precio; precio_lista es el del catálogo al cotizar (si difiere de precio, el comercial lo cambió).';
comment on column public.cotizaciones.aprobacion is
  '{por, en, desc, solicitado, comentario, precios?} de la aprobación del supervisor; precios = [{producto_id, precio}] cambios de precio aprobados.';

commit;
