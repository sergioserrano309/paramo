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
- **Perfil y rol explícitos:** Auth no crea `profiles` sola. El flujo operativo es el módulo
  `/usuarios` (supervisor): API crea Auth + `profiles`. El primer supervisor (bootstrap)
  se crea a mano (Table Editor o SQL en `supabase/local/`, no versionado). Sin fila o con
  `activo=false`, la app niega el acceso.
- **Rate limit en memoria** en login (10/min por IP): suficiente para un CRM interno; no sustituye un WAF.

## Novedades respecto al as-is

- El as-is usaba PIN local o `window.claude` (Artifacts). Aquí: Supabase Auth + cookies + CRM protegido por middleware/layout.
- Se eliminó el botón “Entrar al CRM (preview)”.
- No hay trigger que asigne rol al registrarse; altas posteriores van por `/usuarios`.

## Cómo probar / operar

1. Aplica la migración en tu proyecto Supabase (CLI o SQL Editor).
2. Completa `.env.local` (ver `.env.example`).
3. **Bootstrap (primer supervisor):** crea un usuario en Authentication → Users e inserta
   la fila en `profiles` con el mismo `id`, email, nombre y `rol = 'supervisor'`. Puedes
   guardar ese SQL en `supabase/local/` (solo tu máquina; no va a GitHub). Ejemplo:

```sql
insert into public.profiles (id, email, nombre, rol, activo)
values (
  '<uuid-de-auth.users>',
  'correo@ejemplo.com',
  'Nombre',
  'supervisor',
  true
);
```

4. `npm run dev` → `/login` con ese correo/contraseña.
5. Con ese supervisor, crea el resto de usuarios en `/usuarios` (ver [03-usuarios.md](./03-usuarios.md)).
6. Sin sesión, abrir `/dashboard` debe redirigir a `/login`.

### Fuera de alcance de este hito

- Matriz fina rol × módulo × acción → ver [02-permisos.md](./02-permisos.md).
- Registro self-service público.
- Recuperación de contraseña / MFA.
