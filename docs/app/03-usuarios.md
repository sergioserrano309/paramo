# Usuarios — alta y listado (solo supervisor)

## Desarrollado

- Módulo `/usuarios` en el shell (menú solo `supervisor`).
- Capacidades: módulo `usuarios` + acción `usuarios` en `src/config/permissions.ts`.
- UI: formulario de alta + tabla de listado (`src/components/UsuariosPanel.tsx`).
- Endpoints:
  - `GET /api/usuarios` — lista perfiles (`id`, `email`, `nombre`, `rol`, `activo`, `creado_en`).
  - `POST /api/usuarios` — crea usuario en Supabase Auth (`email_confirm: true`) e inserta
    fila en `public.profiles` con el rol indicado.

Campos de alta: nombre, correo, contraseña (mín. 8), rol (`comercial` | `supervisor`).

## Decisiones

- **Automatización en la API, no en SQL.** No hay trigger en `auth.users`. El supervisor
  autoriza vía sesión + reconsulta de `profiles`; el servidor usa `service_role` para
  `auth.admin.createUser` + `INSERT` en `profiles`. Alternativa descartada: trigger que
  cree perfil al registrarse — crearía filas ante cualquier alta en Auth y mezclaría
  esquema con asignación de rol.
- **Rollback:** si falla el insert en `profiles`, se elimina el usuario Auth recién creado
  (evita identidad sin autorización de negocio).
- **Listo para entrar:** `email_confirm: true` en el alta; no pide verificación de correo.
- **Mensajes genéricos** en errores de API (no filtrar detalles de Auth/SQL).
- **Fuera de este hito:** editar, desactivar, resetear contraseña.

## Novedades respecto al as-is

- En el as-is, usuarios/PIN vivían en Supervisión (modo local). Aquí: módulo aparte
  `/usuarios` con Auth real + `profiles`.
- Supervisión sigue como stub de bitácora/auditoría.

## Cómo probar / operar

1. Migración `profiles` aplicada; primer supervisor creado a mano (Auth + fila en
   `profiles` con `rol=supervisor`; SQL opcional en `supabase/local/`) — ver
   [01-auth.md](./01-auth.md).
2. Login como supervisor → menú «Usuarios».
3. Crear un comercial: nombre, correo, contraseña, rol Comercial → debe aparecer en la
   tabla y poder entrar en `/login` de inmediato.
4. Con sesión `comercial`: no ver «Usuarios»; `GET /usuarios` → redirect a `/dashboard`;
   `GET/POST /api/usuarios` → 403.

## Archivos clave

- `src/app/(app)/usuarios/page.tsx`
- `src/components/UsuariosPanel.tsx`
- `src/app/api/usuarios/route.ts`
- `src/config/navigation.ts`, `src/config/permissions.ts`
