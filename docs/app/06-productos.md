# Productos — catálogo y precios por tipo de cliente (Hito 5)

## Desarrollado

- Módulo `/productos` operativo (deja de ser placeholder).
- Migración `20261023090000_crear_productos.sql`: tabla `productos` (RLS + `revoke`, sin
  políticas, trigger de `actualizado_en`) y aclaración del comentario de
  `tipos_cliente.descuento_pct_default`.
- Seed `supabase/seed/003_productos.sql` con las 21 referencias del sitio (estado `activo`,
  sin precios especiales).
- Listado en tarjetas: línea, presentación, nombre, estado, PVP, aviso de precios por
  aprobar. Filtro por estado, búsqueda por nombre / SKU / línea. Orden del as-is:
  lanzamiento, desarrollo, activo, descontinuado y luego nombre.
- Ficha en drawer: nombre*, PVP*, línea, estado, presentación, SKU, lanzamiento y
  descripción; tabla de **precios por tipo de cliente** (% sobre el PVP o precio fijo) con
  precio resultante en vivo y estado (En firme / Por aprobar / Lista general).
- Botón «Llenar con la lista general» (as-is `ppFill`).
- Eliminar con confirmación (borrado real, como el as-is).
- Acciones registradas en `bitacora` (`src/lib/bitacora.ts`): producto creado / editado /
  eliminado, precios definidos o propuestos, precio especial aprobado o rechazado.

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/productos` | Acceso al módulo `productos` |
| `POST` | `/api/productos` | `editar` **o** `asignar` (as-is `canEditProd`) |
| `PATCH` | `/api/productos/[id]` | `editar` **o** `asignar` |
| `DELETE` | `/api/productos/[id]` | `editar` **o** `asignar` |
| `POST` | `/api/productos/[id]/precios` | `asignar` (supervisor) — `{ accion: "aprobar"\|"rechazar", tipo }` |

Todas validan con zod, limitan el body y aplican rate limit. Los errores de validación de
precios devuelven un mensaje accionable (422); los de permisos, el 401/403 uniforme.

### Reglas de precios (as-is `prForm`, `ppOk`, `ppNo`)

- **PVP obligatorio** (> 0).
- **Alta:** todos los tipos de cliente salvo «Consumidor final» exigen precio.
- Rangos: % entre 0 y 90; precio fijo > 0.
- **Supervisor guarda → en firme** de inmediato (y se limpia el pendiente de ese tipo).
- **Comercial guarda → pendiente** hasta que el supervisor apruebe; mientras tanto se cotiza
  con la lista general. Si lo que propone coincide con lo vigente, se descarta su pendiente.
- El supervisor aprueba o rechaza cada pendiente desde la ficha del producto.
- Precio por tipo (`precioParaTipo`, `src/lib/precios.ts`): precio especial en firme del
  producto; si no existe, `PVP × (1 − descuento_pct_default / 100)` redondeado a decenas.
  «Consumidor final» paga el PVP.
- Las cotizaciones reutilizarán `precioParaTipo`.

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Precios por tipo | Dos columnas `jsonb` (`precios`, `precios_pendientes`) en `productos` | Tabla `productos_precios` (más integridad, una tabla más; AGENTS §3.2) |
| Línea y estado | `CHECK` + `src/config/productos.ts` | Tablas de catálogo de 4 filas |
| Nombre único | Índice único sobre `lower(btrim(nombre))` (el as-is rechaza duplicados; ventas cruzará por nombre) | Sin unicidad. Límite: no ignora tildes (requeriría `unaccent`) |
| % de la lista general | Se reutiliza `tipos_cliente.descuento_pct_default` (sin columna nueva) | Columna aparte para «override» |
| Borrado | Real, como el as-is. Las ventas no dependen del catálogo por FK | Soft-delete por estado `descontinuado` (ver «Próximos posibles desarrollos») |
| Bitácora | Helper `registrarBitacora`; si falla, no tumba la operación | Fallar la operación si falla el log |
| «Importar las 21 referencias» | No hay botón: el seed `003_productos.sql` hace lo mismo y está versionado | Botón que duplique el catálogo en código |

## Novedades respecto al as-is

- Persistencia Postgres + API (`service_role`), no Firestore ni `localStorage`.
- Precios propuestos guardan quién y cuándo; el nombre se resuelve en el servidor.
- **Fuera del módulo, tal como lo ubica el as-is:** el panel «Listas de precios» (editar los
  % de la lista general, acción `usuarios`) vive en **Supervisión**, y «Precios por
  aprobar» / «Descuentos por aprobar» en **Dashboard** y **Supervisión**. Se construyen con
  esos módulos; la API de edición de los % también.
- Primer módulo que escribe en `bitacora`. Prospectos y Funnel aún no lo hacen (se
  completa con Supervisión).

## Cómo probar / operar

1. Aplicar la migración `20261023090000_crear_productos.sql` en Supabase.
2. Aplicar el seed `supabase/seed/003_productos.sql` (SQL Editor).
3. Login `comercial` → `/productos`: ver las 21 referencias, abrir una, definir precios y
   guardar → quedan **Por aprobar**.
4. Login `supervisor` → mismo producto: **Aprobar** / **Rechazar**. Como supervisor,
   editar y guardar precios los deja **En firme**.
5. Crear un producto: exige PVP y un precio por cada tipo de cliente; nombre repetido →
   «Ya existe un producto con ese nombre.».
6. Eliminar con confirmación; revisar `public.bitacora` para ver las acciones.
7. Móvil (~360px): tarjetas en una columna; la tabla de precios hace scroll horizontal.

## Archivos clave

- `supabase/migrations/20261023090000_crear_productos.sql`
- `supabase/seed/003_productos.sql`
- `src/app/(app)/productos/page.tsx`, `src/components/ProductosPanel.tsx`
- `src/app/api/productos/route.ts`, `[id]/route.ts`, `[id]/precios/route.ts`
- `src/lib/productos.ts` (carga, validación zod, aplicar propuesta de precios)
- `src/lib/precios.ts` (precio por tipo de cliente, reutilizable en cotizaciones)
- `src/lib/bitacora.ts`, `src/lib/http.ts`, `src/lib/types/producto.ts`
- `src/config/productos.ts`

## Fuera de alcance (siguientes hitos)

- «Seguimiento» de la ficha **completo**: ventas a 12 meses, clientes que compran, serie
  mensual y principales clientes (`GET /api/productos/[id]/ventas`), más prospectos
  interesados y retroalimentación / degustaciones (ver 12-ficha-prospecto).
- Listas de precios (% por tipo de cliente) y paneles de aprobación: Supervisión / Dashboard.

## Próximos posibles desarrollos (no están en el as-is)

- Soft-delete: no borrar productos, solo `descontinuado`, para no perder historial.
- Tablas puente para «prospectos interesados» y retroalimentación (hoy viven dentro del
  documento del producto en el as-is).
- Nombre único sin distinguir tildes (extensión `unaccent`).
- Migrar `precios` / `precios_pendientes` a una tabla relacional si el catálogo crece.
