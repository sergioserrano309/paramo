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

**Importante:** una migración en el repo no cuenta hasta aplicarla en el proyecto Supabase.

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

### Inventario objetivo (aún sin migración)

`prospectos` · `compromisos` · `cotizaciones` · `productos` · `ventas` ·
`ventas_meses` · `observaciones` · `bitacora`

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
