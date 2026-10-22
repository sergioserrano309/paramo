# Permisos — Hito 2 (roles × módulos × acciones)

## Desarrollado

- Matriz as-is documentada en [`docs/platform/04-roles-y-permisos.md`](../platform/04-roles-y-permisos.md).
- Capacidades canónicas en `src/config/permissions.ts`:
  - comercial → `editar`
  - supervisor → `observar`, `asignar`, `auditar`, `usuarios`
- Helpers en `src/lib/permissions.ts`: `can`, `assertCan`, `canAccessModule`,
  `requireModuleAccess`, `requireApiPermission`.
- Menú filtrado por rol (`navForRol`): Supervisión y Usuarios solo para supervisor.
- Cada página de módulo llama `requireModuleAccess` (servidor).
- `GET /api/auth/me` → perfil + acciones + módulos permitidos.

## Decisiones

- **Fuente de verdad:** el HTML de `pre-arquitectura/` (no inventar permisos).
- **UI + servidor:** el menú oculta; la página y la API niegan. Ocultar no autoriza.
- **Middleware sin rol:** el edge solo valida sesión (Hito 1). El rol se reconsulta
  desde `profiles` en layout/páginas/API (sin `service_role` en el edge).
- **Ownership fino** (responsable de prospecto, etc.) queda documentado para cuando
  existan las tablas; el Hito 2 fija rol × módulo × acción base.

## Novedades respecto al as-is

- Misma separación comercial/supervisor y misma exclusión de Supervisión al comercial.
- En Next.js el bloqueo de `/supervision` es redirect a `/dashboard` (equivalente a
  forzar `view = 'dashboard'` en el HTML).

## Cómo probar

1. Usuario `comercial`: no ve «Supervisión» ni «Usuarios»; esas rutas → `/dashboard`.
2. Usuario `supervisor`: ve «Supervisión» y «Usuarios» y puede abrirlas.
3. `GET /api/auth/me` con sesión: `acciones` y `modulos` coherentes con el rol.
4. En APIs: usar `requireApiPermission('usuarios')` (etc.) antes de mutar — ver
   [03-usuarios.md](./03-usuarios.md).

## Fuera de alcance

- Ownership fila a fila completo (editar ficha, filtros por responsable). Ver
  [04-prospectos.md](./04-prospectos.md): hoy la lista es «todos ven todos» y el
  comercial puede elegir responsable en el alta — ambas cosas pendientes de
  validar con negocio.
- Resto de botones de acción por pantalla en stubs pendientes.
