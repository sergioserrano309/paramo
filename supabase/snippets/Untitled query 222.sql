-- Seed: catálogos del módulo Prospectos (valores del as-is en pre-arquitectura).
-- Aplicar a mano tras la migración 20261022170000_crear_prospectos_y_catalogos.sql.
-- Idempotente: on conflict do update / do nothing.
-- Sin datos personales reales.

begin;

insert into public.canales (codigo, nombre, orden, activo) values
  ('supermercado_gran_superficie', 'Supermercado / Gran superficie', 1, true),
  ('tienda_saludable_naturista', 'Tienda saludable / Naturista', 2, true),
  ('cafeteria_horeca', 'Cafetería / HORECA', 3, true),
  ('distribuidor', 'Distribuidor', 4, true),
  ('corporativo_institucional', 'Corporativo / Institucional', 5, true),
  ('gimnasio_wellness', 'Gimnasio / Wellness', 6, true),
  ('ecommerce', 'E-commerce', 7, true),
  ('exportacion', 'Exportación', 8, true),
  ('otros', 'Otros', 9, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  orden = excluded.orden,
  activo = excluded.activo;

insert into public.fuentes (codigo, nombre, orden, activo) values
  ('referido', 'Referido', 1, true),
  ('feria_evento', 'Feria / evento', 2, true),
  ('visita_en_frio', 'Visita en frío', 3, true),
  ('instagram_web', 'Instagram / web', 4, true),
  ('linkedin', 'LinkedIn', 5, true),
  ('base_de_datos', 'Base de datos', 6, true),
  ('otro', 'Otro', 7, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  orden = excluded.orden,
  activo = excluded.activo;

insert into public.tipos_cliente (codigo, nombre, descuento_pct_default, orden, activo) values
  ('distribuidor', 'Distribuidor', 35, 1, true),
  ('cadena', 'Gran superficie / Cadena', 28, 2, true),
  ('tienda', 'Tienda / Detal', 20, 3, true),
  ('horeca', 'HORECA', 18, 4, true),
  ('corporativo', 'Corporativo / Institucional', 12, 5, true),
  ('final', 'Consumidor final (PVP)', 0, 6, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descuento_pct_default = excluded.descuento_pct_default,
  orden = excluded.orden,
  activo = excluded.activo;

insert into public.etapas_funnel (codigo, nombre, probabilidad, orden, en_pipeline, activo) values
  ('prospecto', 'Prospecto', 10, 1, true, true),
  ('contactado', 'Contactado', 20, 2, true, true),
  ('muestra', 'Muestra / degustación', 40, 3, true, true),
  ('propuesta', 'Propuesta enviada', 60, 4, true, true),
  ('negociacion', 'Negociación', 80, 5, true, true),
  ('ganado', 'Ganado', 100, 6, false, true),
  ('perdido', 'Perdido', 0, 7, false, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  probabilidad = excluded.probabilidad,
  orden = excluded.orden,
  en_pipeline = excluded.en_pipeline,
  activo = excluded.activo;

commit;
