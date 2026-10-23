# Documentación de la app (Next.js)

Índice de lo implementado en la plataforma Páramo Snacks.

## Contenido

| Doc | Tema |
|---|---|
| [00-setup.md](./00-setup.md) | Setup inicial: instalar, variables, correr en local |
| [01-auth.md](./01-auth.md) | Auth Hito 1: login, profiles, middleware, logout |
| [02-permisos.md](./02-permisos.md) | Permisos Hito 2: roles, módulos, `can` / guards |
| [03-usuarios.md](./03-usuarios.md) | Usuarios: alta Auth + profiles (solo supervisor) |
| [04-prospectos.md](./04-prospectos.md) | Prospectos: catálogos, alta, listado, bitácora (esquema) |
| [05-funnel.md](./05-funnel.md) | Funnel: tablero por etapas, mover, Abrir (ver + etapa) |
| [06-productos.md](./06-productos.md) | Productos: catálogo, precios por tipo de cliente y aprobación |
| [07-cotizaciones.md](./07-cotizaciones.md) | Cotizaciones: borradores, aprobación de descuento, PDF |
| [08-ventas.md](./08-ventas.md) | Ventas: carga de Excel, análisis por cliente / producto |
| [09-compromisos.md](./09-compromisos.md) | Compromisos: agenda, asignación y seguimiento |
| [10-supervision.md](./10-supervision.md) | Supervisión: KPI, observaciones, listas de precios, bitácora |
| [11-dashboard.md](./11-dashboard.md) | Dashboard: KPI, agenda, funnel, ventas y alertas |
| [12-ficha-prospecto.md](./12-ficha-prospecto.md) | Ficha del prospecto, listado con filtros, interesados y retroalimentación |
| [13-shell.md](./13-shell.md) | Menú móvil, contadores, tema y atajos de teclado |

## Módulos (rutas)

Rutas bajo `src/app/(app)/` (requieren sesión; acceso por rol en Hito 2):

- `/dashboard`
- `/supervision` — solo `supervisor`
- `/usuarios` — solo `supervisor` (crear y listar)
- `/prospectos` — listado + alta (barra rápida y drawer)
- `/funnel` — tablero kanban, mover etapa, Abrir, + Prospecto
- `/compromisos`
- `/cotizaciones`
- `/productos`
- `/ventas`

Auth: `/login`. APIs: `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/me`, `GET /api/health`, `GET/POST /api/usuarios`,
`GET/POST /api/prospectos`, `PATCH /api/prospectos/[id]/etapa`,
`GET/POST /api/productos`, `PATCH/DELETE /api/productos/[id]`,
`POST /api/productos/[id]/precios`, `GET /api/productos/[id]/ventas`,
`GET/POST /api/cotizaciones`, `PATCH/DELETE /api/cotizaciones/[id]`,
`POST /api/cotizaciones/[id]/estado`, `POST /api/cotizaciones/[id]/descarga`,
`GET /api/ventas/resumen`, `POST /api/ventas/cargar`, `DELETE /api/ventas/meses/[mes]`,
`GET/POST /api/compromisos`, `PATCH/DELETE /api/compromisos/[id]`,
`POST /api/compromisos/[id]/hecho`, `GET/POST /api/observaciones`,
`POST/DELETE /api/observaciones/[id]`, `PATCH /api/config/precios`, `GET /api/bitacora`,
`GET/PATCH/DELETE /api/prospectos/[id]`, `POST /api/prospectos/[id]/actividad`,
`POST /api/prospectos/[id]/activo`, `POST /api/prospectos/[id]/interes`,
`GET /api/productos/[id]/seguimiento`, `POST /api/productos/[id]/feedback`.

Matriz detallada: [`docs/platform/04-roles-y-permisos.md`](../platform/04-roles-y-permisos.md).
