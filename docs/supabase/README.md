# Supabase — mapa del proyecto

## Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + servidor | Proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente (Auth) | Login; no para datos de negocio |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | API routes; bypass RLS |
| `NEXT_PUBLIC_APP_URL` | Cliente + servidor | URL base de la app |

Detalle y ejemplos: [`.env.example`](../../.env.example).

## Modelo de acceso

- RLS habilitada en tablas `public`.
- Sin políticas por defecto + `revoke` a `anon` / `authenticated`.
- Lectura/escritura de negocio solo con `service_role` desde API routes.

## Tablas canónicas (objetivo)

Aún no hay migraciones aplicadas. Inventario previsto (ver `AGENTS.md` §3.2):

`profiles` · `prospectos` · `compromisos` · `cotizaciones` · `productos` · `ventas` ·
`ventas_meses` · `observaciones` · `bitacora`

## Carpetas

- `supabase/migrations/` — SQL versionado (Supabase CLI / recreación local).
- `supabase/seed/` — datos mock (no son migraciones).

Cuando exista la primera migración, documenta aquí el mapeo as-is → tabla.
