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
| `20261022153000_crear_profiles.sql` | Tabla `profiles`, RLS+revoke, trigger al crear `auth.users` |

**Importante:** una migración en el repo no cuenta hasta aplicarla en el proyecto Supabase.

## Tablas

### `profiles` (existe en migración)

| Columna | Notas |
|---|---|
| `id` | PK = `auth.users.id` |
| `email` | Copia operativa |
| `nombre` | Visible en shell |
| `rol` | `comercial` \| `supervisor` |
| `activo` | Si `false`, login y layout niegan acceso |

Default al registrarse: `rol=comercial`, `activo=true`.

### Inventario objetivo (aún sin migración)

`prospectos` · `compromisos` · `cotizaciones` · `productos` · `ventas` ·
`ventas_meses` · `observaciones` · `bitacora`

## Carpetas

- `supabase/migrations/` — SQL versionado.
- `supabase/seed/` — datos mock (no son migraciones).
