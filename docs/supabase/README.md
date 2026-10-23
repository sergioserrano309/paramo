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

**Importante:** una migración en el repo no cuenta hasta aplicarla en el proyecto Supabase.

### Seed (aplicar a mano)

| Archivo | Qué hace |
|---|---|
| `002_catalogos_prospectos.sql` | Inserta canales, fuentes, tipos de cliente y etapas del as-is |

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
`ref_tabla` / `ref_id`. Solo esquema en este hito (sin writes desde la app aún).

Detalle de app: [docs/app/04-prospectos.md](../app/04-prospectos.md) y
[docs/app/05-funnel.md](../app/05-funnel.md) (cambio de etapa).

### `compromisos` (migración + escritura desde `/compromisos`)

Agenda de seguimientos (as-is). Columnas clave: `titulo`, `tipo` (CHECK con
Llamada, Visita, WhatsApp, Correo, Enviar muestra, Degustación, Enviar
cotización, Seguimiento, Cobro, Otro), `fecha`, `prospecto_id` (nullable),
`hecho` / `hecho_en`, `asignado`, `responsable_id`, `creado_por`.

Índice parcial para «próximo compromiso» por prospecto. La app lee pendientes
para listado Prospectos y tarjetas Funnel, y escribe desde `/compromisos`
(`POST/PATCH/DELETE`). Sin seed. Al marcar cumplido con prospecto, la API
pone `prospectos.ultimo_contacto` en el día de Bogotá.

Detalle: [docs/app/06-compromisos.md](../app/06-compromisos.md).

### Inventario objetivo (aún sin migración de dominio)

`cotizaciones` · `productos` · `ventas` · `ventas_meses` · `observaciones`

(`prospectos`, `bitacora` y `compromisos` ya tienen migración. `compromisos`
se escribe desde `/compromisos`. `bitacora` sigue sin escritura desde la app.)

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
