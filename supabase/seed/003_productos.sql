-- Seed mock: las 21 referencias publicadas en paramosnacks.com (as-is CATALOGO).
-- Aplicar a mano tras la migración 20261023090000_crear_productos.sql.
-- Precios públicos de referencia (octubre 2026), no precios de venta a canal.
-- Quedan en estado `activo` y sin precios especiales: se cotiza con la lista general
-- (tipos_cliente.descuento_pct_default) hasta que se definan por producto.
-- Idempotente: el nombre es único, así que correrlo dos veces no duplica filas.

begin;

insert into public.productos (nombre, linea, presentacion, precio_publico, estado)
values
  ('Manzana 12g', 'frutas', '12 g', 5900, 'activo'),
  ('Manzana 20g', 'frutas', '20 g', 8100, 'activo'),
  ('Plátano Maduro 15g', 'frutas', '15 g', 5900, 'activo'),
  ('Plátano Maduro 28g', 'frutas', '28 g', 7300, 'activo'),
  ('Piña Chips 20g', 'frutas', '20 g', 8600, 'activo'),
  ('Piña Bites 15g', 'frutas', '15 g', 6500, 'activo'),
  ('Piña Bites 28g', 'frutas', '28 g', 8600, 'activo'),
  ('Remolacha Yacón 15g', 'vegetales', '15 g', 6500, 'activo'),
  ('Remolacha Yacón 28g', 'vegetales', '28 g', 8600, 'activo'),
  ('Coliflor y Queso 15g', 'vegetales', '15 g', 6500, 'activo'),
  ('8-pack Fruity Delights', 'packs', '8 un.', 63900, 'activo'),
  ('12-pack Fruity Delights', 'packs', '12 un.', 65900, 'activo'),
  ('8-pack Manzana 20g', 'packs', '8 × 20 g', 58320, 'activo'),
  ('8-pack Piña Chips 20g', 'packs', '8 × 20 g', 65520, 'activo'),
  ('8-pack Plátano Maduro 28g', 'packs', '8 × 28 g', 55920, 'activo'),
  ('8-pack Piña Bites 28g', 'packs', '8 × 28 g', 65520, 'activo'),
  ('12-pack Coliflor y Queso 15g', 'packs', '12 × 15 g', 70200, 'activo'),
  ('12-pack Remolacha Yacón 15g', 'packs', '12 × 15 g', 70200, 'activo'),
  ('12-pack Plátano Maduro 15g', 'packs', '12 × 15 g', 63720, 'activo'),
  ('12-pack Manzana 12g', 'packs', '12 × 12 g', 63720, 'activo'),
  ('12-pack Piña 15g', 'packs', '12 × 15 g', 70200, 'activo')
on conflict (lower(btrim(nombre))) do nothing;

commit;
