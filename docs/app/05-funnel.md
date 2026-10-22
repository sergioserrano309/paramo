# Funnel — tablero por etapas (Hito 4)

## Desarrollado

- Módulo `/funnel` operativo (deja de ser placeholder).
- Tablero kanban con las 7 etapas de `etapas_funnel` (incluye Ganado y Perdido).
- Solo prospectos **activos** (`vivos()` del as-is).
- Tarjeta: empresa, avatar del responsable, ★ calificación, canal, valor/mes,
  alerta stale (≥14 días sin contacto vía `ultimo_contacto` o `creado_en`),
  **Abrir** y **→** (avanzar una etapa en columnas `en_pipeline`).
- Movimiento de etapa:
  - Desktop (`pointer: fine`): drag & drop entre columnas + botón →.
  - Al arrastrar cerca del borde izquierdo/derecho del tablero, el board hace
    auto-scroll horizontal para alcanzar columnas fuera de vista (p. ej. Ganado).
  - Móvil: sin drag; → y/o pasos de etapa en el drawer.
- Modal de motivo al pasar a **Perdido** (`MOTIVOS_PERDIDA`).
- Al pasar a **Ganado**: setea `ganado_en` (fecha Bogotá).
- Persistencia: `PATCH /api/prospectos/[id]/etapa` actualiza `etapa_codigo`,
  `etapa_desde`, `motivo_perdida` / `ganado_en`.
- Botón **+ Prospecto** (y Agregar en columna Prospecto) → drawer de alta (mismo
  POST `/api/prospectos` que el módulo Prospectos). Sin barra rápida en funnel.
- Drawer **Abrir**: layout alineado al as-is; en este hito solo **ver datos** +
  **cambiar etapa**. Secciones de otros módulos y ediciones de ficha:
  visibles deshabilitadas con etiqueta **Próximamente**.

### API

| Método | Ruta | Quién |
|---|---|---|
| `PATCH` | `/api/prospectos/[id]/etapa` | Acceso módulo `funnel` + `canEditProspecto` |

Body: `{ etapa_codigo, motivo_perdida? }`. Si `etapa_codigo === 'perdido'`,
`motivo_perdida` es obligatorio y debe estar en el catálogo de motivos.

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Quién mueve | As-is `canEditP`: `editar` **o** soy el responsable | Supervisor con `asignar` mueve todo (ver validación abajo) |
| Bitácora / actividad | **Sin** writes al cambiar etapa | Log inmediato (queda para Supervisión / actividad) |
| Próximo compromiso en tarjeta | Omitido (módulo compromisos después) | Mostrar stub vacío |
| Stale | Sí, con `ultimo_contacto` \|\| día de `creado_en` | Omitir alerta |
| Drawer Abrir | Ver + cambiar etapa; resto Próximamente | Editar ficha / inactivar en este hito |
| DnD móvil | Desactivado; → y pasos de etapa | Librería touch de drag |

### Permiso de movimiento — validar con negocio

Se replicó el as-is (`canEditP`):

- Comercial (`editar`): puede mover cualquier tarjeta.
- Supervisor: **no** tiene `editar`; solo mueve si es el `responsable_id` del
  prospecto (caso poco frecuente).

**Necesario validar:** ¿el supervisor debería poder reordenar el funnel de toda
la cartera (p. ej. vía `asignar`), o se mantiene esta regla? Documentar el
veredicto cuando se decida. Helper: `canEditProspecto` en
`src/lib/permissions.ts`.

### Visibilidad

Comercial y supervisor ven **todos** los activos en el board (como el as-is /
listado de prospectos). Ownership de lectura pendiente de validar en el módulo
Prospectos; cuando se acuerde, aplicar la misma regla aquí.

## Novedades respecto al as-is

- Persistencia Postgres/API (`service_role`), no Firestore.
- Sin append a `actividad` ni insert en `bitacora` al cambiar etapa.
- Sin “próximo compromiso” en la tarjeta.
- Drawer: acciones de módulos no desarrollados deshabilitadas (Próximamente),
  no omitidas del layout.

## Cómo probar / operar

1. Migración + seed de catálogos ya aplicados (etapas en `etapas_funnel`).
2. Tener prospectos activos (crear desde `/prospectos` o `+ Prospecto` en funnel).
3. Login `comercial` → `/funnel`: ver columnas, arrastrar (desktop), →, Abrir.
4. Pasar a Perdido: elegir motivo; comprobar `motivo_perdida` y columna.
5. Pasar a Ganado: toast y `ganado_en`.
6. Login `supervisor` (sin ser responsable): Abrir en lectura; no arrastra ni →
   salvo que sea responsable de esa fila.
7. Móvil (~360px): scroll horizontal del board; mover con → o pasos del drawer.

## Archivos clave

- `src/app/(app)/funnel/page.tsx`
- `src/components/FunnelPanel.tsx`
- `src/app/api/prospectos/[id]/etapa/route.ts`
- `src/config/funnel.ts`, `src/config/motivos-perdida.ts`
- `src/lib/format.ts`, `src/lib/permissions.ts` (`canEditProspecto`)
- Tokens de columna: `src/styles/paramo-theme.css` (`--paramo-stage-*`, `--paramo-rasp`)

## Fuera de alcance (siguientes hitos)

- Editar datos / calificación / responsable desde el drawer.
- Inactivar / reactivar / eliminar.
- Actividad, compromisos, cotizaciones, productos de interés, observaciones,
  historial (habilitar cuando existan esos módulos).
- Writes a `bitacora` y timeline de actividad al cambiar etapa.
- Ownership de lectura (filtrar board por responsable).
