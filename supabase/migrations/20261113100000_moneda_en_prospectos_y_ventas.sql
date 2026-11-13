-- Decisión: la venta mensual estimada del prospecto y las ventas cargadas desde Excel
-- también pueden estar en COP o USD. Se agrega una columna `moneda` a tablas existentes
-- (AGENTS.md §3.2) y los totales se reportan SIEMPRE por moneda, nunca sumados entre sí:
-- no hay tasa de cambio en el sistema (ver 20261113090000_precios_usd_y_moneda_cotizacion).
--
--   prospectos.valor_moneda -> moneda de valor_mensual_estimado (default COP: lo existente).
--   ventas.moneda           -> moneda de cada línea del Excel (columna opcional «Moneda»;
--                              vacía = COP, así los archivos actuales siguen cargando igual).
--
-- Las columnas de dinero pasan a 2 decimales para admitir centavos en USD; ampliar la escala
-- no altera los valores COP ya guardados.
--
-- `ventas_por_mes.valor` pasa a ser solo COP y se agrega `valor_usd`; `ventas_resumen` y
-- `ventas_totales` reciben `p_moneda` (default COP) y filtran por ella. Se eliminan las
-- firmas anteriores: dejarlas junto a las nuevas haría ambigua la llamada por nombre desde
-- PostgREST. `cargar_ventas` lee `moneda` de cada fila (null = COP) y sigue reemplazando por
-- completo los meses que trae el archivo, en ambas monedas.
--
-- Sin INSERT de datos de negocio.

begin;

alter table public.prospectos
  add column if not exists valor_moneda text not null default 'COP';

alter table public.prospectos drop constraint if exists prospectos_valor_moneda_check;
alter table public.prospectos
  add constraint prospectos_valor_moneda_check check (valor_moneda in ('COP', 'USD'));

alter table public.prospectos
  alter column valor_mensual_estimado type numeric(14, 2);

comment on column public.prospectos.valor_moneda is
  'Moneda de valor_mensual_estimado (COP | USD). Los totales del funnel y el dashboard se reportan por moneda.';
comment on column public.prospectos.valor_mensual_estimado is
  'Venta mensual estimada, en la moneda de valor_moneda (as-is valor).';

-- Postgres no deja cambiar el tipo de una columna que usa una vista: se elimina
-- `ventas_por_mes` aquí y se recrea más abajo (es la única vista que depende de ventas.valor).
drop view if exists public.ventas_por_mes;

alter table public.ventas
  add column if not exists moneda text not null default 'COP';

alter table public.ventas drop constraint if exists ventas_moneda_check;
alter table public.ventas
  add constraint ventas_moneda_check check (moneda in ('COP', 'USD'));

alter table public.ventas
  alter column valor type numeric(14, 2);

comment on column public.ventas.moneda is
  'Moneda del valor de la línea (COP | USD); viene de la columna «Moneda» del Excel, vacía = COP.';
comment on column public.ventas.valor is
  'Valor de la línea antes de IVA, en la moneda de `moneda`.';

-- Consulta típica: ventas de un rango de fechas en una moneda.
create index if not exists ventas_moneda_fecha_idx on public.ventas (moneda, fecha);

-- «Meses cargados»: valor = COP; valor_usd es la columna nueva.
create view public.ventas_por_mes
with (security_invoker = true) as
select
  v.mes,
  count(*)::integer as filas,
  coalesce(sum(v.unidades), 0) as unidades,
  coalesce(sum(v.valor) filter (where v.moneda = 'COP'), 0) as valor,
  max(v.archivo) as archivo,
  max(v.cargado_en) as cargado_en,
  (array_agg(v.cargado_por order by v.cargado_en desc))[1] as cargado_por,
  coalesce(sum(v.valor) filter (where v.moneda = 'USD'), 0) as valor_usd
from public.ventas v
group by v.mes;

comment on view public.ventas_por_mes is
  'Resumen por mes cargado (as-is ventasMeses). valor = COP, valor_usd = USD. Derivado de ventas.';

revoke all on public.ventas_por_mes from anon, authenticated;

create or replace function public.cargar_ventas(
  p_filas jsonb,
  p_archivo text,
  p_usuario uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  insertadas integer;
begin
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas debe ser un arreglo';
  end if;

  delete from public.ventas
  where mes in (
    select distinct to_char(f.fecha, 'YYYY-MM')
    from jsonb_to_recordset(p_filas) as f(fecha date)
  );

  insert into public.ventas (
    mes, fecha, cliente, canal, ciudad, producto, producto_clave,
    unidades, valor, moneda, archivo, cargado_por
  )
  select
    to_char(f.fecha, 'YYYY-MM'), f.fecha, f.cliente, coalesce(f.canal, ''),
    coalesce(f.ciudad, ''), f.producto, f.producto_clave,
    f.unidades, f.valor, coalesce(nullif(f.moneda, ''), 'COP'), p_archivo, p_usuario
  from jsonb_to_recordset(p_filas) as f(
    fecha date, cliente text, canal text, ciudad text, producto text,
    producto_clave text, unidades numeric, valor numeric, moneda text
  );

  get diagnostics insertadas = row_count;
  return insertadas;
end;
$$;

revoke all on function public.cargar_ventas(jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.cargar_ventas(jsonb, text, uuid) to service_role;

drop function if exists public.ventas_resumen(date, date, text, text, text);
create or replace function public.ventas_resumen(
  p_desde date,
  p_hasta date,
  p_por text,
  p_cliente text default null,
  p_producto_clave text default null,
  p_moneda text default 'COP'
)
returns table (
  clave text,
  etiqueta text,
  canal text,
  unidades numeric,
  valor numeric,
  ultima date,
  clientes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      v.*,
      case p_por
        when 'cliente' then v.cliente
        when 'producto' then v.producto_clave
        when 'canal' then coalesce(nullif(trim(v.canal), ''), '(sin dato)')
        when 'mes' then v.mes
      end as k
    from public.ventas v
    where v.fecha between p_desde and p_hasta
      and v.moneda = p_moneda
      and (p_cliente is null or v.cliente = p_cliente)
      and (p_producto_clave is null or v.producto_clave = p_producto_clave)
  )
  select
    b.k as clave,
    case when p_por = 'producto' then min(b.producto) else b.k end as etiqueta,
    coalesce(nullif(max(b.canal), ''), '') as canal,
    sum(b.unidades) as unidades,
    sum(b.valor) as valor,
    max(b.fecha) as ultima,
    count(distinct b.cliente) as clientes
  from base b
  where b.k is not null
  group by b.k
  order by sum(b.valor) desc, b.k;
$$;

revoke all on function public.ventas_resumen(date, date, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ventas_resumen(date, date, text, text, text, text)
  to service_role;

comment on function public.ventas_resumen(date, date, text, text, text, text) is
  'Totales de ventas en una moneda, agrupados por cliente | producto | canal | mes dentro de un rango de fechas.';

drop function if exists public.ventas_totales(date, date);
create or replace function public.ventas_totales(
  p_desde date,
  p_hasta date,
  p_moneda text default 'COP'
)
returns table (valor numeric, unidades numeric, clientes bigint, filas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(v.valor), 0),
    coalesce(sum(v.unidades), 0),
    count(distinct v.cliente),
    count(*)
  from public.ventas v
  where v.fecha between p_desde and p_hasta
    and v.moneda = p_moneda;
$$;

revoke all on function public.ventas_totales(date, date, text)
  from public, anon, authenticated;
grant execute on function public.ventas_totales(date, date, text) to service_role;

commit;
