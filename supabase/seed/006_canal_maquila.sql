-- Seed: canal «Maquila». Aplicar a mano (SQL Editor) tras 005. Idempotente.
--
-- Decisión: Maquila usa por ahora la lista de precios de Distribuidor, igual que Mayorista,
-- hasta que el negocio defina una lista propia (si se define, basta cambiar
-- canales.tipo_cliente_codigo de este canal; no hace falta tocar código ni productos).
-- Va al final del desplegable (orden 8).

begin;

insert into public.canales (codigo, nombre, orden, activo, tipo_cliente_codigo) values
  ('maquila', 'Maquila', 8, true, 'distribuidor')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  orden = excluded.orden,
  activo = excluded.activo,
  tipo_cliente_codigo = excluded.tipo_cliente_codigo;

commit;
