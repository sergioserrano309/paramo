-- Seed: tipo de cliente por defecto de cada canal (as-is CANAL_TIPO).
-- Aplicar a mano tras la migración 20261023110000_crear_cotizaciones.sql y los seeds
-- 002 (canales y tipos de cliente). Idempotente.

begin;

update public.canales set tipo_cliente_codigo = 'cadena' where codigo = 'supermercado_gran_superficie';
update public.canales set tipo_cliente_codigo = 'tienda' where codigo = 'tienda_saludable_naturista';
update public.canales set tipo_cliente_codigo = 'horeca' where codigo = 'cafeteria_horeca';
update public.canales set tipo_cliente_codigo = 'distribuidor' where codigo = 'distribuidor';
update public.canales set tipo_cliente_codigo = 'corporativo' where codigo = 'corporativo_institucional';
update public.canales set tipo_cliente_codigo = 'tienda' where codigo = 'gimnasio_wellness';
update public.canales set tipo_cliente_codigo = 'final' where codigo = 'ecommerce';
update public.canales set tipo_cliente_codigo = 'distribuidor' where codigo = 'exportacion';
update public.canales set tipo_cliente_codigo = 'tienda' where codigo = 'otros';

commit;
