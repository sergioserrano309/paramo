# Documentación de la app (Next.js)

Índice de lo implementado en la plataforma Páramo Snacks.

## Contenido

| Doc | Tema |
|---|---|
| [00-setup.md](./00-setup.md) | Setup inicial: instalar, variables, correr en local |
| [01-auth.md](./01-auth.md) | Auth Hito 1: login, profiles, middleware, logout |
| [02-permisos.md](./02-permisos.md) | Permisos Hito 2: roles, módulos, `can` / guards |
| [03-usuarios.md](./03-usuarios.md) | Usuarios: alta Auth + profiles (solo supervisor) |

## Módulos (rutas)

Rutas bajo `src/app/(app)/` (requieren sesión; acceso por rol en Hito 2):

- `/dashboard`
- `/supervision` — solo `supervisor`
- `/usuarios` — solo `supervisor` (crear y listar)
- `/prospectos`
- `/funnel`
- `/compromisos`
- `/cotizaciones`
- `/productos`
- `/ventas`

Auth: `/login`. APIs: `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/me`, `GET /api/health`, `GET/POST /api/usuarios`.

Matriz detallada: [`docs/platform/04-roles-y-permisos.md`](../platform/04-roles-y-permisos.md).
