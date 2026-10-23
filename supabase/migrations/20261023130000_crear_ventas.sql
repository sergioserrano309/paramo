-- Decisión: `ventas` guarda una fila por línea del Excel (fecha, cliente, producto,
-- unidades, valor). El as-is las empaquetaba en documentos de 1.500 filas por mes porque
-- Firestore lo exigía; en Postgres no hace falta y permite agregar en SQL.
--
-- `ventas_meses` del inventario objetivo NO es una tabla: es la vista `ventas_por_mes`
-- (filas, unidades, valor y archivo por mes se derivan de `ventas`). Una tabla aparte
-- obligaría a mantener dos fuentes de verdad por mes (AGENTS.md §3.2: primero una vista).
--
-- Cruce con productos: se guarda `producto` (texto tal como vino del Excel) y
-- `producto_clave` (nombre sin tildes, espacios ni signos, como pkey() del as-is). El cruce
-- con el catálogo se hace por esa clave y se resuelve al consultar, igual que el as-is, así
-- una referencia agregada al catálogo después se enlaza sola. Alternativa descartada por
-- ahora: FK `producto_id` fijada al cargar (queda desactualizada si el producto se crea o
-- renombra después) — ver docs/app/08-ventas.md.
--
-- Carga atómica: `cargar_ventas` reemplaza por completo los meses que trae el archivo y
-- inserta las filas en una sola transacción. Con llamadas separadas desde la API, un fallo
-- a la mitad dejaría un mes borrado y a medio cargar (el as-is lo hacía por lotes).
--
-- Sin INSERT de datos de negocio.

begin;

create table if not exists public.ventas (
  id bigint generated always as identity primary key,
  mes text not null,
  fecha date not null,
  cliente text not null,
  canal text not null default '',
  ciudad text not null default '',
  producto text not null,
  producto_clave text not null,
  unidades numeric(14, 2) not null,
  valor numeric(14, 0) not null,
  archivo text not null default '',
  cargado_en timestamptz not null default now(),
  cargado_por uuid references public.profiles (id) on delete set null,
  constraint ventas_mes_formato check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint ventas_cliente_no_vacio check (length(trim(cliente)) > 0),
  constraint ventas_producto_no_vacio check (length(trim(producto)) > 0)
);

comment on table public.ventas is
  'Líneas de venta cargadas desde la plantilla Excel (as-is ventas): una fila por cliente, producto y fecha.';
comment on column public.ventas.mes is
  'AAAA-MM de la fecha; unidad de reemplazo en cada carga.';
comment on column public.ventas.cliente is
  'Nombre del cliente tal como viene en la factura (texto libre, no FK a prospectos).';
comment on column public.ventas.canal is
  'Canal como viene en el Excel (texto libre, opcional).';
comment on column public.ventas.producto is
  'Referencia tal como viene en el Excel.';
comment on column public.ventas.producto_clave is
  'Clave normalizada (sin tildes, espacios ni signos) para cruzar con productos.nombre.';
comment on column public.ventas.valor is
  'COP antes de IVA.';

-- Reemplazo y borrado de un mes completo.
create index if not exists ventas_mes_idx on public.ventas (mes);
-- Análisis por período (rango de fechas).
create index if not exists ventas_fecha_idx on public.ventas (fecha);
-- Ventas de un producto (ficha de producto) y de un cliente (expandir en Ventas).
create index if not exists ventas_producto_clave_idx on public.ventas (producto_clave);
create index if not exists ventas_cliente_idx on public.ventas (cliente);

alter table public.ventas enable row level security;
revoke all on public.ventas from anon, authenticated;

-- «Meses cargados» (as-is ventasMeses).
create or replace view public.ventas_por_mes
with (security_invoker = true) as
select
  v.mes,
  count(*)::integer as filas,
  coalesce(sum(v.unidades), 0) as unidades,
  coalesce(sum(v.valor), 0) as valor,
  max(v.archivo) as archivo,
  max(v.cargado_en) as cargado_en,
  (array_agg(v.cargado_por order by v.cargado_en desc))[1] as cargado_por
from public.ventas v
group by v.mes;

comment on view public.ventas_por_mes is
  'Resumen por mes cargado (as-is ventasMeses). Derivado de ventas.';

revoke all on public.ventas_por_mes from anon, authenticated;

-- Carga atómica: reemplaza los meses presentes en el archivo.
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
    unidades, valor, archivo, cargado_por
  )
  select
    to_char(f.fecha, 'YYYY-MM'), f.fecha, f.cliente, coalesce(f.canal, ''),
    coalesce(f.ciudad, ''), f.producto, f.producto_clave,
    f.unidades, f.valor, p_archivo, p_usuario
  from jsonb_to_recordset(p_filas) as f(
    fecha date, cliente text, canal text, ciudad text, producto text,
    producto_clave text, unidades numeric, valor numeric
  );

  get diagnostics insertadas = row_count;
  return insertadas;
end;
$$;

revoke all on function public.cargar_ventas(jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.cargar_ventas(jsonb, text, uuid) to service_role;

-- Agregados para Ventas, fichas de producto y Dashboard. Evita volcar filas al navegador
-- (AGENTS §4): el cliente solo recibe totales por cliente / producto / canal / mes.
create or replace function public.ventas_resumen(
  p_desde date,
  p_hasta date,
  p_por text,
  p_cliente text default null,
  p_producto_clave text default null
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

revoke all on function public.ventas_resumen(date, date, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ventas_resumen(date, date, text, text, text)
  to service_role;

comment on function public.ventas_resumen(date, date, text, text, text) is
  'Totales de ventas agrupados por cliente | producto | canal | mes dentro de un rango de fechas.';

create or replace function public.ventas_totales(p_desde date, p_hasta date)
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
  where v.fecha between p_desde and p_hasta;
$$;

revoke all on function public.ventas_totales(date, date)
  from public, anon, authenticated;
grant execute on function public.ventas_totales(date, date) to service_role;

commit;
