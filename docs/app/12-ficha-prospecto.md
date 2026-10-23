# Ficha del prospecto, listado y piezas relacionadas (Hito 11)

> **Merge con main:** `/prospectos` y `/funnel` abren `ProspectoDetalleDrawer`.
> `?nuevo=` abre el alta y `?abrir=` abre ese drawer. El historial que lee la
> app es `prospectos.actividad` (jsonb), no la tabla `prospecto_actividad`.
> `ProspectoFicha` sigue sirviendo a las rutas de actividad, interés y activo.

Completa lo que el as-is hacía con el prospecto y que quedó «Próximamente» en los hitos de
Prospectos (04) y Funnel (05).

## Desarrollado

- **Listado `/prospectos`** como el as-is: filtros por etapa («En gestión» por defecto,
  «Todas», cada etapa, «Inactivos (N)»), canal, responsable y calificación; búsqueda;
  columnas calificación, etapa, responsable (con iniciales), venta mensual, **próximo
  compromiso** y **último contacto** (en rojo si lleva 14+ días); insignia de observaciones
  abiertas; tarjetas en móvil. Orden: calificación, etapa y valor. `?nuevo=…` abre el alta y
  `?abrir=ID` abre la ficha.
- **Ficha** (`ProspectoFicha`, la misma en Prospectos y en «Abrir» del Funnel): calificación
  ★ (tocar la estrella actual la quita), responsable (reasignar), etapa clicable (con motivo
  al pasar a Perdido), inactivar / reactivar con motivo, observaciones del supervisor,
  registrar actividad (Llamada, Visita, WhatsApp, Correo, Degustación, Reunión),
  cotizaciones del prospecto (con enlace y «Nueva cotización»), compromisos (marcar hecho y
  «Agendar» / «Asignar tarea»), productos de interés, edición de datos, eliminar e
  historial.
- **Funnel:** la tarjeta muestra el próximo compromiso; «Abrir» usa la ficha completa. Un
  prospecto inactivado desde la ficha sale del tablero.
- **Productos:** «Prospectos interesados» y «Retroalimentación y degustaciones» (tipo,
  cliente, calificación 1–5, comentario) en la ficha; en las tarjetas, interesados y
  calificación promedio. **Dashboard:** «Productos nuevos» muestra interesados y promedio.
- **Supervisión:** KPI «Contactos con clientes», «Avances en el funnel» y columna
  «Contactos (N d)» de la cartera salen del historial; la bitácora enlaza a la ficha del
  prospecto, producto o cotización (`?abrir=ID`).
- Migración `20261024090000_crear_ficha_prospecto.sql`: `prospecto_actividad`,
  `prospecto_productos` y `producto_feedback` (RLS + `revoke`).

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/prospectos/[id]` | Acceso a Prospectos: ficha completa |
| `PATCH` | `/api/prospectos/[id]` | `{tipo: "datos" \| "calificacion" \| "responsable"}`; editar = `editar` o ser el responsable; reasignar = además `asignar` |
| `DELETE` | `/api/prospectos/[id]` | Quien puede editar; borra también sus compromisos (historial e interés en cascada) |
| `POST` | `/api/prospectos/[id]/actividad` | Quien puede editar, prospecto activo |
| `POST` | `/api/prospectos/[id]/activo` | Quien puede editar: inactivar (con motivo) o reactivar |
| `POST` | `/api/prospectos/[id]/interes` | Quien puede editar: marca / quita un producto |
| `GET` | `/api/productos/[id]/seguimiento` | Interesados y opiniones |
| `POST` | `/api/productos/[id]/feedback` | `editar` o `asignar` |

### Historial (`prospecto_actividad`)

Se escribe al: registrar actividad, cambiar de etapa («Pasó a X · motivo», también por una
cotización enviada o aceptada), inactivar / reactivar («Estado») y cumplir un compromiso
(«Cumplido: …»). Cumplir un compromiso y registrar actividad marcan hoy como último
contacto.

## Decisiones

| Tema | Decisión | Alternativa descartada |
|---|---|---|
| Historial, interés y opiniones | Tres tablas pequeñas, cada una justificada en el encabezado de la migración | `jsonb` dentro de `prospectos` / `productos` (como el as-is): imposible de sumar en SQL |
| Una sola ficha | Un componente para Prospectos y Funnel | Dos drawers distintos |
| Crear compromiso y cotización desde la ficha | Enlace al módulo con el prospecto preseleccionado | Duplicar los formularios dentro de la ficha |
| Compromiso cumplido | Entra al historial y a la bitácora | Solo bitácora |

## Novedades respecto al as-is

- Persistencia en Postgres; permisos revalidados en el servidor.
- «Agendar» y «Nueva cotización» abren el módulo respectivo (no un modal sobre la ficha).
- Borrar un prospecto no borra sus cotizaciones (quedan con el nombre del cliente).

## Cómo probar / operar

1. Aplicar `20261024090000_crear_ficha_prospecto.sql`.
2. `/prospectos`: filtrar, abrir una ficha, calificar, reasignar, cambiar de etapa (probar
   Perdido), registrar actividad, marcar productos de interés, inactivar y reactivar.
3. `/funnel`: «Abrir» muestra la misma ficha; el próximo compromiso aparece en la tarjeta.
4. `/productos`: abrir un producto con interesados y agregar una opinión.
5. `/supervision`: los KPI de contactos y avances reflejan lo registrado.

## Archivos clave

- `supabase/migrations/20261024090000_crear_ficha_prospecto.sql`
- `src/components/ProspectoFicha.tsx`, `src/components/ProspectosPanel.tsx`
- `src/app/api/prospectos/[id]/` (`route.ts`, `actividad`, `activo`, `interes`)
- `src/lib/ficha-prospecto.ts`, `src/lib/actividad.ts`, `src/lib/productos-seguimiento.ts`
- `src/app/api/productos/[id]/seguimiento`, `src/app/api/productos/[id]/feedback`
- `src/config/prospectos.ts`

## Fuera de alcance

- Fusionar prospectos duplicados.
- Varios contactos por prospecto (tabla `contactos`; ver 04-prospectos).
