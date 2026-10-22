# Documentación de la app (Next.js)

Índice de lo implementado en la plataforma Páramo Snacks.

## Contenido

| Doc | Tema |
|---|---|
| [00-setup.md](./00-setup.md) | Setup inicial: instalar, variables, correr en local |
| [01-auth.md](./01-auth.md) | Auth Hito 1: login, profiles, middleware, logout |

## Módulos (rutas)

Rutas bajo `src/app/(app)/` (requieren sesión):

- `/dashboard`
- `/supervision`
- `/prospectos`
- `/funnel`
- `/compromisos`
- `/cotizaciones`
- `/productos`
- `/ventas`

Auth: `/login`. APIs: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/health`.

Actualiza este índice al entregar cada módulo.
