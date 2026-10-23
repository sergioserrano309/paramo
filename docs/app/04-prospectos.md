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
  - Click en fila / card → mismo drawer de detalle que **Abrir** en Funnel
    (`ProspectoDetalleDrawer`: ver + cambiar etapa; resto Próximamente).
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
| Compromisos | Tabla + lectura de próximo. Alta en `/compromisos` | Stub permanente / seed mock |
| Click fila | Drawer compartido con Funnel | Solo navegación / sin acción |
| Bitácora | Tabla creada; **sin** insert al crear aún | Log inmediato |
| Visibilidad lista | Ambos roles ven **todos** | Filtrar por responsable (pendiente) |

### Pendiente (documentado a propósito)

- Badge de observaciones abiertas en la columna Empresa.
- Inactivar / reactivar desde listado o ficha.
- Cambiar calificación con click en estrellas.
- Compromisos dentro de la ficha (sigue «Próximamente»). La agenda está en `/compromisos`.
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
- Ficha: actividad, productos de interés, observaciones, cotizaciones y
  compromisos embebidos siguen **Próximamente** (layout visible, deshabilitado).
- Filtro de calificación por igualdad exacta (no ≥).
- Default de filtro de etapa: todas (no «En gestión»).

## Cómo probar / operar

1. Aplicar migraciones `…_prospectos_y_catalogos` y `…_crear_compromisos` en Supabase.
2. Aplicar seed `002_catalogos_prospectos.sql`.
3. Login → `/prospectos`: ver columnas, pills, avatar+rol, filtros.
4. Click en una fila → drawer de detalle; cambiar etapa si `canEditProspecto`.
5. Alta rápida / completa como antes.
6. Sin pendientes en `compromisos`: columna «Sin compromiso». Con filas, fecha y título.
7. Móvil (~360px): cards en lugar de tabla.

## Archivos clave

- `supabase/migrations/20261022170000_crear_prospectos_y_catalogos.sql`
- `supabase/migrations/20261022193000_crear_compromisos.sql`
- `src/app/(app)/prospectos/page.tsx`
- `src/components/ProspectosPanel.tsx`
- `src/components/ProspectoDetalleDrawer.tsx`
- `src/components/StagePill.tsx`, `WhoChip.tsx`, `CompromisoFechaText.tsx`
- `src/lib/compromisos.ts`, `src/config/compromisos.ts`, `src/config/calificacion.ts`
- `src/app/api/prospectos/route.ts`
- `src/lib/permissions.ts` / `src/lib/can.ts`
