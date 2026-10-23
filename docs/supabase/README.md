# Supabase — mapa del proyecto

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + servidor + middleware | Proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth (cookies) + middleware | Login/sesión; no para datos de negocio |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | API/layout: leer `profiles` y datos; bypass RLS |
| `NEXT_PUBLIC_APP_URL` | Cliente + servidor | URL base de la app |

Detalle: [`.env.example`](../../.env.example).

## Modelo de acceso

- RLS habilitada en tablas `public`.
- Sin políticas por defecto + `revoke` a `anon` / `authenticated`.
- Lectura/escritura de negocio solo con `service_role` desde API/servidor autorizado.
- Auth de usuario: anon key + cookies (`@supabase/ssr`).

## Migraciones aplicadas (en repo)

| Archivo | Qué hace |
|---|---|
| `20261022153000_crear_profiles.sql` | Tabla `profiles`, RLS+revoke, trigger `actualizado_en` (sin auto-perfil al registrarse) |
| `20261022170000_crear_prospectos_y_catalogos.sql` | Catálogos (`canales`, `fuentes`, `tipos_cliente`, `etapas_funnel`), `prospectos`, `bitacora` (esquema); RLS+revoke |
| `20261022193000_crear_compromisos.sql` | Tabla `compromisos` (agenda); tipos en CHECK; RLS+revoke; sin seed |
| `20261022223000_ficha_prospecto_actividad_observaciones.sql` | Columna `prospectos.actividad` y tabla `observaciones`; RLS+revoke |

| `20261023110000_crear_cotizaciones.sql` | Tabla `cotizaciones` (líneas en `items jsonb`, número `COT-AAAA-NNN` por trigger), RLS+revoke; columna `canales.tipo_cliente_codigo` |
| `20261023130000_crear_ventas.sql` | Tabla `ventas`, vista `ventas_por_mes`, funciones `cargar_ventas` / `ventas_resumen` / `ventas_totales` (solo `service_role`) |
| `20261023150000_crear_compromisos.sql` | No altera `compromisos` si la de main ya existe (`create table if not exists`) |
| `20261023170000_crear_observaciones.sql` | No recrea `observaciones` si la de main ya existe |
| `20261024090000_crear_ficha_prospecto.sql` | `prospecto_productos` y `producto_feedback` (la app sí los usa). También crea `prospecto_actividad`, que la app no consulta: el historial está en `prospectos.actividad` |
| `20261024180000_observaciones_prospecto_opcional.sql` | `observaciones.prospecto_id` pasa a ser opcional (nota de gestión general) |
| `20261023090000_crear_productos.sql` | Tabla `productos` (precios por tipo de cliente en `jsonb`, nombre único), RLS+revoke, trigger `actualizado_en`; aclara el comentario de `tipos_cliente.descuento_pct_default` |

**Importante:** una migración en el repo no cuenta hasta aplicarla en el proyecto Supabase.

### Seed (aplicar a mano)

| Archivo | Qué hace |
|---|---|
| `002_catalogos_prospectos.sql` | Inserta canales, fuentes, tipos de cliente y etapas del as-is |
| `003_productos.sql` | Inserta las 21 referencias del sitio (requiere la migración de productos) |
| `004_canal_tipo_cliente.sql` | Asigna a cada canal su tipo de cliente por defecto (requiere la migración de cotizaciones) |

## Tablas

### `profiles` (existe en migración)

| Columna | Notas |
|---|---|
| `id` | PK = `auth.users.id` |
| `email` | Copia operativa |
| `nombre` | Visible en shell |
| `rol` | `comercial` \| `supervisor` (obligatorio en el INSERT; sin default) |
| `activo` | Si `false`, login y layout niegan acceso (default `true` en columna) |

La fila en `profiles` no se crea sola al registrar en Auth. Flujo operativo: módulo
`/usuarios` (API crea Auth + profiles). Bootstrap del primer supervisor: SQL en
`supabase/local/` (solo máquina local) o Table Editor. Ver [docs/app/01-auth.md](../app/01-auth.md)
y [docs/app/03-usuarios.md](../app/03-usuarios.md).

### Catálogos y `prospectos` (migración + seed)

Tablas de catálogo (PK `codigo` texto): `canales`, `fuentes`, `tipos_cliente`,
`etapas_funnel`. Valores iniciales en `supabase/seed/002_catalogos_prospectos.sql`.

`prospectos`: empresa, contacto (columnas), FKs a catálogos, `responsable_id` →
`profiles`, calificación 0–3, etapa, valor mensual, activo, auditoría
(`creado_por` / `actualizado_por`). Sin UNIQUE en `empresa`.

`bitacora`: `ocurrido_en`, `actor_id`, `rol`, `accion`, `detalle` (≤400),
`ref_tabla` / `ref_id`. Los módulos nuevos (productos, cotizaciones, ventas,
observaciones, login/logout y cumplir un compromiso) escriben ahí. El alta de
prospecto y el cambio de etapa de main dejan el historial en
`prospectos.actividad`.

Detalle de app: [docs/app/04-prospectos.md](../app/04-prospectos.md) y
[docs/app/05-funnel.md](../app/05-funnel.md) (cambio de etapa).

### `actividad` y `observaciones`

`prospectos.actividad` es el historial de la ficha: lista jsonb
`{ f, t, x, u }`. Empieza vacía; no reconstruye hechos anteriores. Supervisión
y la ficha leen esa columna. La migración `20261024090000` también crea
`prospecto_actividad`; la app no la usa como fuente.

`observaciones`: texto del supervisor, estado `abierta` / `atendida`,
respuesta del comercial. `prospecto_id` puede ser null (nota de gestión
general). Si hay prospecto, se borra en cascada con él. RLS + revoke, sin
políticas. La app escribe con `service_role`.

### `compromisos`

Agenda de seguimientos (as-is). La tabla canónica es
`20261022193000_crear_compromisos.sql`: `titulo`, `tipo` (CHECK), `fecha`,
`prospecto_id` (nullable), `hecho` / `hecho_en`, `asignado`, `responsable_id`
(nullable), `creado_por`. No tiene `actualizado_por`.

`20261023150000_crear_compromisos.sql` usa `create table if not exists` y no
cambia esa tabla si ya existe. La pantalla y `POST/PATCH/DELETE` son los de
main. `POST /api/compromisos/[id]/hecho` marca hecho sobre el mismo esquema.

Detalle: [docs/app/06-compromisos.md](../app/06-compromisos.md).

### `productos`, `cotizaciones` y `ventas`

Catálogo de productos (`precios` y `precios_pendientes` en jsonb), cotizaciones
y ventas. `ventas_meses` del inventario original no es tabla: es la vista
`ventas_por_mes`. También: `prospecto_productos` y `producto_feedback`
(ficha de producto e interesados).

Detalle: [docs/app/06-productos.md](../app/06-productos.md),
[docs/app/07-cotizaciones.md](../app/07-cotizaciones.md) y
[docs/app/08-ventas.md](../app/08-ventas.md).

**Orden para aplicar en un proyecto nuevo:** profiles → prospectos y catálogos
→ compromisos (main) → actividad/observaciones de la ficha → productos →
cotizaciones → ventas → observaciones de módulos (no recrea la tabla) →
ficha (`prospecto_productos`, `producto_feedback`) → observaciones con
prospecto opcional. Luego seeds 002, 003 y 004.

## Carpetas

### `supabase/migrations/`

SQL versionado del **esquema y reglas** de la base: tablas, columnas, índices, constraints,
RLS, `revoke`, triggers, funciones, vistas, relaciones.

**No** incluir aquí `INSERT` / `UPDATE` ni carga de filas (negocio, catálogo o prueba).
Detalle de la anatomía: `AGENTS.md` §3.3.

### `supabase/seed/`

SQL de **mock / semilla versionado**: datos de prueba que el equipo comparte para probar
el proyecto. No son migraciones.

- Sí se versiona en el repo (empezar por `001_ejemplo_mock.sql`).
- Aplicación **manual** tras las migraciones (SQL Editor / `psql`).
- Sin datos personales reales ni secretos.
- Bootstrap del primer supervisor **no** va aquí.

Reglas: `AGENTS.md` §3.4.

### `supabase/local/`

SQL **ad hoc solo en local** mientras se desarrolla (escenarios temporales, bootstrap del
primer supervisor, experimentos).

- Ignorada en `supabase/.gitignore` (`local/`): **no se sube a GitHub**.
- Cada desarrollador crea la carpeta en su máquina si la necesita.
- Ejecución manual, sin orden fijo.

Reglas: `AGENTS.md` §3.5.
