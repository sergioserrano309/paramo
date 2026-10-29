# Permisos de edición y visibilidad por responsable

Reglas de negocio acordadas tras la revisión del 2026-10-28. **Cambian el as-is**: allí el
comercial (`editar`) tocaba toda la cartera. «Administrador» = rol `supervisor`.

## Desarrollado

| Tema | Regla | Dónde |
|---|---|---|
| Ver prospectos | El comercial ve los de todos los comerciales, **nunca** los que tienen al supervisor como responsable (da igual quién los creó). El supervisor ve todo | `src/lib/visibilidad.ts` |
| Editar / mover prospectos | Cada usuario solo lo que tiene asignado (supervisor incluido). Los demás se ven, no se tocan | `canEditProspecto` en `src/lib/can.ts` |
| Asignar a otra persona | Solo el supervisor (`asignar`): al crear y al reasignar. El comercial crea prospectos para sí mismo | `canAsignarResponsable`, `POST /api/prospectos` |
| Cotizaciones | Se ven las de prospectos de comerciales (no las de prospectos del supervisor); se crean y editan solo las de prospectos propios | `puedeEditarCotizacion`, `cargarCotizaciones` |
| Compromisos | El comercial **no edita ni borra** lo que le asignó el supervisor; sí lo marca hecho. Lo que él mismo crea sí lo edita | `canEditCompromiso` / `canToggleCompromiso` |
| Cotización: tipo y fecha | El tipo de cliente sale del prospecto (su canal) y la fecha es la del registro; ambos solo lectura y el servidor los fija. Al editar no cambia la fecha | `prepararGuardado` |
| Cotización aprobada | Con el descuento aprobado (`final` + `aprobacion`) queda bloqueada. Para cambiarla: «Crear nueva versión» (vuelve a borrador). Si el descuento no cambia no se pide otra aprobación | `estaBloqueada` en `src/config/cotizaciones.ts` |
| Dinero | Campos de pesos con puntos de miles (`1.000.000`) | `src/components/InputMoneda.tsx` |

La visibilidad se aplica **en el servidor** (listado y funnel de prospectos, API de
prospectos, ficha `relacionados` y observaciones, cotizaciones y su PDF, Dashboard, selector
de Compromisos e «interesados» / opiniones de Productos), no solo ocultando botones. Si no se
puede resolver quiénes son los supervisores, falla cerrado (error), no muestra todo.

## Decisiones

- **Un solo punto** para la regla de visibilidad (`visibilidad.ts`), para que no se escape un
  lugar.
- **El comercial puede marcar hecho** lo que le asignó el supervisor: es como reporta el
  cumplimiento; editarlo es lo que se pierde el control.
- **Cotización aprobada**: nueva versión en lugar de reabrir. Mantener el mismo % no pide
  aprobación otra vez; cambiarlo sí.
- Se eliminó `src/lib/compromisos-permisos.ts` (nadie lo usaba y contradecía `can.ts`) y
  `POST /api/productos/[id]/feedback` (la retroalimentación se registra desde el prospecto).

## Novedades / límites

- Los **contadores** de interesados y opiniones en las tarjetas de producto aún cuentan los
  prospectos del supervisor (solo la cifra; los nombres y textos sí se filtran).
- Un compromiso sin `creado_por` (p. ej. el creador fue borrado) no lo edita el comercial.
- Si un prospecto pasa a manos del supervisor, el comercial deja de verlo, y también sus
  cotizaciones.

## Cómo probar

1. Login `comercial`: crear un prospecto (el responsable solo puede ser él).
2. Login `supervisor`: crear un prospecto propio; el comercial **no** debe verlo en
   Prospectos, Funnel, Cotizaciones ni Dashboard.
3. Comercial A mira un prospecto de comercial B: lo ve en el Funnel, pero no lo arrastra ni
   edita.
4. Supervisor asigna un compromiso a un comercial: el comercial lo marca hecho, pero no ve
   editar ni eliminar.
5. Nueva cotización: tipo y fecha deshabilitados. Con descuento > 5 %: pedir aprobación,
   aprobar como supervisor; la cotización queda bloqueada y sin aviso; «Crear nueva versión»
   la reabre.
