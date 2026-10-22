# Prospectos — alta y listado (Hito 3)

## Desarrollado

- Módulo `/prospectos` operativo (deja de ser placeholder).
- Migración `20261022170000_crear_prospectos_y_catalogos.sql`:
  - Catálogos normalizados: `canales`, `fuentes`, `tipos_cliente`, `etapas_funnel`.
  - Tabla `prospectos` con FKs a catálogos y a `profiles` (`responsable_id`).
  - Tabla `bitacora` (solo esquema; sin escritura en este hito).
- Seed `supabase/seed/002_catalogos_prospectos.sql` con valores del as-is.
- API:
  - `GET /api/prospectos` — listado (ambos roles con acceso al módulo).
  - `POST /api/prospectos` — alta (`editar` **o** `asignar`, como `canCreateP`).
- UI (`ProspectosPanel`):
  - Barra rápida (`quickP`, como el as-is): **solo empresa es obligatoria**;
    contacto, teléfono, canal y responsable son opcionales (responsable default = yo;
    etapa fija `prospecto`). Con solo el nombre + Agregar debe crear.
  - Botón «Prospecto» → drawer con formulario completo del as-is (misma regla:
    solo empresa obligatoria).
  - Listado con búsqueda local por empresa/contacto/NIT/etc.

### Campos del formulario completo (drawer)

| Campo | Obligatorio |
|---|---|
| Empresa | **Sí** (único requerido, como el as-is) |
| NIT, Contacto, Cargo, Teléfono, Correo, Ciudad | No |
| Canal, Tipo de cliente, Fuente | No (`null` / vacío permitido) |
| Venta mensual estimada, Calificación, Notas | No (default 0 / vacío) |
| Etapa | No (default `prospecto`) |
| Responsable | No (default = usuario actual) |

Contacto/cargo/teléfono/email viven como **columnas** de `prospectos` (un contacto
principal). La API acepta `null`, `""` u omitir en opcionales (Zod no los rechaza).

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Catálogos | Tablas + FK + seed | Texto libre / solo `CHECK` en app |
| Contacto | Columnas en `prospectos` | Tabla `contactos` 1:N (futuro si hay varios) |
| Campos obligatorios al alta | Solo `empresa` (as-is) | Exigir catálogos/contacto |
| Duplicidad empresa | **Sin** UNIQUE | Había pedido de unicidad; se revirtió |
| Crear | `editar` \|\| `asignar` | Solo comercial |
| Responsable al alta | Select de usuarios activos; default = yo | Forzar siempre al creador |
| Bitácora | Tabla creada; **sin** insert al crear aún | Log inmediato (queda para Supervisión) |
| Visibilidad lista | Ambos roles ven **todos** | Filtrar por responsable (pendiente validar) |

### Barra rápida — ¿es necesaria?

Se portó porque el as-is la usa para altas mínimas sin abrir el drawer (empresa +
Agregar). Comportamiento alineado: solo `empresa` obligatoria. **Pendiente validar
con el equipo** si aporta en operación diaria o si basta el drawer completo.
Mientras tanto se mantiene.

### Asignar responsable al crear (comercial)

En el as-is el comercial **puede elegir** `responsable` en el alta aunque no tenga la
acción de negocio `asignar` (esa es del supervisor para reasignar/aprobar). Aquí se
replicó ese comportamiento.

**Necesario validar con el negocio:** ¿el comercial debe poder asignar a otro usuario
en el alta, o solo a sí mismo? Documentar el veredicto cuando se decida.

### Visibilidad «todos ven todos»

Hoy comercial y supervisor listan la cartera completa (como el as-is de listado).

**Necesario validar:** si el comercial debe ver solo sus prospectos (`responsable_id = yo`)
u ownership más fino; eso se aplicará encima de `can` cuando se acuerde.

### Contactos en el futuro

Si un prospecto necesita varios contactos (compras, gerencia, etc.), conviene crear
tabla `contactos` (`prospecto_id`, nombre, cargo, teléfono, email, principal…) y migrar
las columnas actuales. No se hace en este hito.

## Novedades respecto al as-is

- Persistencia en Postgres/Supabase vía API (`service_role`), no Firestore/localStorage.
- Catálogos normalizados (códigos estables) en lugar de strings sueltos en el documento.
- Sin unique de empresa (explícito).
- Sin escritura a bitácora todavía (tabla lista).
- Ficha avanzada (etapas clickeables, actividad, productos de interés, observaciones,
  cotizaciones/compromisos embebidos) **fuera de alcance** de este hito.

## Cómo probar / operar

1. Aplicar migración `20261022170000_crear_prospectos_y_catalogos.sql` en Supabase.
2. Aplicar seed `supabase/seed/002_catalogos_prospectos.sql` (SQL Editor / psql).
3. Login como `comercial` o `supervisor` → `/prospectos`.
4. Alta rápida: empresa + Agregar → aparece en la tabla.
5. Alta completa: «Prospecto» → llenar drawer → Crear prospecto.
6. `comercial` y `supervisor` pueden crear; si en el futuro se restringe el select de
   responsable, ajustar API + UI.
7. Sin seed: los `<select>` de canal/fuente/etapa quedan vacíos o fallan validaciones.

## Archivos clave

- `supabase/migrations/20261022170000_crear_prospectos_y_catalogos.sql`
- `supabase/seed/002_catalogos_prospectos.sql`
- `src/app/(app)/prospectos/page.tsx`
- `src/components/ProspectosPanel.tsx`
- `src/app/api/prospectos/route.ts`
- `src/lib/permissions.ts` (`requireApiAnyPermission`, `canCreateProspecto`)
- `src/lib/types/prospecto.ts`

## Fuera de alcance (siguientes hitos)

- Editar ficha, cambiar etapa, inactivar, eliminar.
- Historial de actividad / productos de interés.
- Inserts en `bitacora` y UI de Supervisión.
- Ownership fila a fila y filtros avanzados del as-is.
- Tabla `contactos` 1:N.
