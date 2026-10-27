-- Decisión: el producto tiene dos identificadores distintos, SKU y Código (antes el campo
-- único «SKU / código» los mezclaba). Es una columna nueva en `productos`: no hace falta
-- otra tabla. Lo que ya estaba en `sku` se queda en `sku`; `codigo` arranca vacío.
-- La columna `lanzamiento` deja de usarse en la app pero no se borra aquí: eliminar datos
-- es irreversible y la decisión la toma el equipo.

begin;

alter table public.productos
  add column if not exists codigo text not null default '';

alter table public.productos drop constraint if exists productos_codigo_len;
alter table public.productos
  add constraint productos_codigo_len check (char_length(codigo) <= 80);

comment on column public.productos.codigo is
  'Código interno del producto, distinto del SKU. Texto libre, máx. 80.';

commit;
