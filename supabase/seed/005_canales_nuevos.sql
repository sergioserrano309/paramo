-- Seed: canales comerciales nuevos (reemplazan los del as-is) y su lista de precios.
-- Aplicar a mano tras 002 y 004. Idempotente.
--
-- Decisión: el CANAL define la lista de precios (canales.tipo_cliente_codigo); el prospecto
-- ya no elige un «Tipo de cliente (precios)» aparte. Por eso:
--   1. se crean/actualizan los 7 canales nuevos con su tipo de precios,
--   2. los prospectos con un canal viejo pasan al canal nuevo equivalente,
--   3. los canales viejos quedan inactivos (no se borran: conserva el historial),
--   4. se limpia prospectos.tipo_cliente_codigo para que mande el canal.
-- Mayorista aún no tiene lista de precios propia: usa la de Distribuidor hasta que el
-- negocio defina una (revisar con el supervisor).

begin;

insert into public.canales (codigo, nombre, orden, activo, tipo_cliente_codigo) values
  ('distribuidor', 'Distribuidor', 1, true, 'distribuidor'),
  ('tienda', 'Tienda', 2, true, 'tienda'),
  ('mayorista', 'Mayorista', 3, true, 'distribuidor'),
  ('grandes_superficies', 'Grandes Superficies', 4, true, 'cadena'),
  ('horeca', 'HORECA', 5, true, 'horeca'),
  ('corporativo', 'Corporativo', 6, true, 'corporativo'),
  ('consumidor_final', 'Consumidor Final', 7, true, 'final')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  orden = excluded.orden,
  activo = excluded.activo,
  tipo_cliente_codigo = excluded.tipo_cliente_codigo;

-- Canal viejo -> canal nuevo (el mismo criterio que el seed 004).
update public.prospectos p set canal_codigo = m.nuevo
from (values
  ('supermercado_gran_superficie', 'grandes_superficies'),
  ('tienda_saludable_naturista', 'tienda'),
  ('cafeteria_horeca', 'horeca'),
  ('corporativo_institucional', 'corporativo'),
  ('gimnasio_wellness', 'tienda'),
  ('ecommerce', 'consumidor_final'),
  ('exportacion', 'distribuidor'),
  ('otros', 'tienda')
) as m (viejo, nuevo)
where p.canal_codigo = m.viejo;

update public.canales set activo = false
where codigo in (
  'supermercado_gran_superficie', 'tienda_saludable_naturista', 'cafeteria_horeca',
  'corporativo_institucional', 'gimnasio_wellness', 'ecommerce', 'exportacion', 'otros'
);

update public.prospectos set tipo_cliente_codigo = null where tipo_cliente_codigo is not null;

commit;
