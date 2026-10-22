# Auth — Hito 1 (sesión + profiles)

## Desarrollado

- Tabla `public.profiles` (migración `supabase/migrations/20261022153000_crear_profiles.sql`).
- Login real con Supabase Auth (email + contraseña).
- Endpoints:
  - `POST /api/auth/login` — zod, rate limit, reconsulta de `profiles`.
  - `POST /api/auth/logout` — cierra sesión (cookies).
- `src/middleware.ts` — sin sesión redirige a `/login` (o 401 en API); con sesión en `/login` → `/dashboard`.
- Layout `(app)` — `requireAuthContext()`: sesión + perfil activo (cinturón y tirantes).
- Shell muestra nombre, rol y botón cerrar sesión.
- Clientes:
  - `src/lib/supabase-auth.ts` — sesión (anon key + cookies).
  - `src/lib/supabase-server.ts` — `service_role` solo servidor (perfil y datos).

## Decisiones

- **Identidad en Auth, autorización en `profiles`.** No se confía solo en claims del JWT.
- **Middleware no usa `service_role`** (no filtrar secretos al edge). Solo valida sesión; el perfil se reconsulta en layout/API.
- **Mensajes de error genéricos** en login (no distinguir email, contraseña o perfil inactivo).
- **Trigger `handle_new_user`:** al crear usuario en Auth se inserta `profiles` con `rol=comercial`. Supervisor se asigna después en Supabase (SQL o Table Editor).
- **Rate limit en memoria** en login (10/min por IP): suficiente para un proceso; no sustituye un WAF.

## Novedades respecto al as-is

- El as-is usaba PIN local o `window.claude` (Artifacts). Aquí: Supabase Auth + cookies + CRM protegido por middleware/layout.
- Se eliminó el botón “Entrar al CRM (preview)”.

## Cómo probar / operar

1. Aplica la migración en tu proyecto Supabase (CLI o SQL Editor).
2. Completa `.env.local` (ver `.env.example`).
3. Crea un usuario en Authentication → Users (o signUp).
4. Confirma que existe fila en `profiles` (el trigger la crea).
5. Para un supervisor: `update public.profiles set rol = 'supervisor' where email = '…';`
6. `npm run dev` → `/login` con ese correo/contraseña.
7. Sin sesión, abrir `/dashboard` debe redirigir a `/login`.

### Fuera de alcance de este hito

- Matriz fina rol × módulo × acción (Hito 2).
- Registro self-service público.
- Recuperación de contraseña / MFA.
