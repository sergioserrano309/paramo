# Prospectos — alta, listado y ficha (Hito 3 + ajuste UI)

## Desarrollado

- Módulo `/prospectos` operativo.
- Migración `20261022170000_crear_prospectos_y_catalogos.sql`:
  - Catálogos: `canales`, `fuentes`, `tipos_cliente`, `etapas_funnel`.
  - Tabla `prospectos` + `bitacora` (esquema; sin escritura en alta).
- Migración `20261022193000_crear_compromisos.sql`: tabla `compromisos`.
  Tipos en `CHECK` alineados al as-is. Alta y agenda: [06-compromisos.md](./06-compromisos.md).
- Seed `supabase/seed/002_catalogos_prospectos.sql`.
- API:
  - `GET /api/prospectos` — listado.
  - `POST /api/prospectos` — alta (`editar` **o** `asignar`).
  - `PATCH /api/prospectos/[id]/etapa` — cambio de etapa desde el drawer
    (mismo endpoint que Funnel; requiere acceso al módulo `funnel`).
- UI (`ProspectosPanel`):
  - Barra rápida (`quickP`): solo empresa obligatoria.
  - Drawer «+ Prospecto» con formulario completo.
  - **Listado alineado al as-is:** columnas Empresa, Calif., Etapa, Responsable,
    Venta mensual est., Próximo compromiso, Último contacto.
  - Empresa: nombre en negrita; debajo `contacto · ciudad`.
  - Etapa: pill + punto de color (`StagePill` / `ETAPA_COL_COLOR`).
  - Responsable: avatar con iniciales + nombre; debajo el rol
    (Comercial / Supervisor).
  - Encabezados de tabla en mayúsculas, peso fuerte y color muted.
  - Filtros: búsqueda libre, etapa (default **Todas las etapas**), canal,
    responsable, calificación por **igualdad exacta**.
  - Móvil: cards compactas; desktop: tabla.
- Ficha (`ProspectoDetalleDrawer`, la misma en Prospectos, Funnel y
  Compromisos):
  - Calificación con estrellas (otro clic en la misma la deja en 0).
  - Cambiar responsable (quien edita el prospecto, o el supervisor).
  - Inactivar con motivo y confirmación, o reactivar.
  - Observaciones del supervisor: crear, retirar la propia abierta;
    el comercial responde y marca atendida.
  - Registrar actividad (actualiza último contacto).
  - Agendar compromiso con este prospecto ya elegido.
  - Editar datos y eliminar (con confirmación; también borra sus compromisos).
  - Historial al final: solo eventos desde que existe la columna `actividad`.
  - Cotizaciones y productos de interés se ven, sin alta.
  - Próximo compromiso: lee pendientes de `compromisos`. Sin filas: «Sin compromiso».

### Campos del formulario completo (drawer de alta)

| Campo | Obligatorio |
|---|---|
| Empresa | **Sí** (único requerido, como el as-is) |
| NIT, Contacto, Cargo, Teléfono, Correo, Ciudad | No |
| Canal, Tipo de cliente, Fuente | No |
| Venta mensual estimada, Calificación, Notas | No |
| Etapa | No (default `prospecto`) |
| Responsable | No (default = usuario actual) |

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Catálogos | Tablas + FK + seed | Texto libre |
| Contacto | Columnas en `prospectos` | Tabla `contactos` 1:N (futuro) |
| Campos obligatorios al alta | Solo `empresa` | Exigir catálogos/contacto |
| Duplicidad empresa | **Sin** UNIQUE | — |
| Crear | `editar` \|\| `asignar` | Solo comercial |
| Listado UI | Paridad visual as-is | Mantener columnas mínimas del hito 3 |
| Filtro etapa default | Todas las etapas | «En gestión» (as-is default) |
| Filtro calificación | Igualdad exacta 0–3 | Umbral ≥ N (as-is) |
| Ficha | Editable: datos, estrellas, responsable, inactivar, actividad, observaciones, agendar, historial | Dejar el drawer en solo lectura |
| Click fila | Drawer compartido con Funnel | Solo navegación / sin acción |
| Bitácora | Tabla creada; **sin** insert al crear aún | Log inmediato |
| Visibilidad lista | Ambos roles ven **todos** | Filtrar por responsable (pendiente) |

### Pendiente (documentado a propósito)

- Badge de observaciones abiertas en la columna Empresa.
- Ownership fila a fila (comercial solo ve los suyos) — validar con negocio.

### Barra rápida — ¿es necesaria?

Se mantiene (as-is). Pendiente validar con el equipo si aporta en operación diaria.

### Asignar responsable al crear (comercial)

Se replicó el as-is: el comercial puede elegir responsable en el alta.
**Validar con negocio** si debe poder asignar a otro o solo a sí mismo.

## Novedades respecto al as-is

- Persistencia Postgres/Supabase vía API (`service_role`).
- Catálogos normalizados.
- Sin unique de empresa.
- Sin escritura a bitácora todavía.
- Ficha operativa (ver arriba). Cotizaciones y productos de interés siguen
  sin alta.
- Filtro de calificación por igualdad exacta (no ≥).
- Default de filtro de etapa: todas (no «En gestión»).

## Cómo probar / operar

1. Aplicar migraciones de prospectos, compromisos y
   `20261022223000_ficha_prospecto_actividad_observaciones.sql`.
2. Aplicar seed `002_catalogos_prospectos.sql`.
3. Login → `/prospectos`: ver columnas, pills, avatar+rol, filtros.
4. Click en una fila → ficha: estrellas, responsable, inactivar, actividad,
   observación (supervisor), agendar, guardar datos, historial.
5. Inactivar: elegir motivo y confirmar. El prospecto sale del funnel.
   Reactivar lo devuelve.
6. Sin pendientes en `compromisos`: columna «Sin compromiso». Con filas, fecha y título.
7. Móvil (~360px): cards en lugar de tabla.

## Archivos clave

- `supabase/migrations/20261022170000_crear_prospectos_y_catalogos.sql`
- `supabase/migrations/20261022193000_crear_compromisos.sql`
- `supabase/migrations/20261022223000_ficha_prospecto_actividad_observaciones.sql`
- `src/app/(app)/prospectos/page.tsx`
- `src/components/ProspectosPanel.tsx`
- `src/components/ProspectoDetalleDrawer.tsx`
- `src/components/StagePill.tsx`, `WhoChip.tsx`, `CompromisoFechaText.tsx`
- `src/lib/compromisos.ts`, `src/config/compromisos.ts`, `src/config/calificacion.ts`
- `src/app/api/prospectos/route.ts`
- `src/app/api/prospectos/[id]/route.ts`
- `src/app/api/prospectos/[id]/etapa/route.ts`
- `src/app/api/prospectos/[id]/observaciones/route.ts`
- `src/lib/actividad.ts`, `src/config/motivos-inactivo.ts`
- `src/lib/permissions.ts` / `src/lib/can.ts`
