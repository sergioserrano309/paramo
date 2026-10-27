# Ficha del prospecto, listado y piezas relacionadas (Hito 11)

> **Estado tras unir con `main` de Andrés:** al hacer clic en un prospecto, `/prospectos` y
> `/funnel` abren `ProspectoDetalleDrawer`. `?nuevo=…` abre el alta y `?abrir=ID` abre ese
> mismo panel. El componente `ProspectoFicha` que se había construido en paralelo se
> eliminó (no se usaba) junto con las rutas `…/actividad` y `…/activo`, que solo él llamaba:
> el panel hace esas acciones con `PATCH /api/prospectos/[id]` (`accion`).

## Desarrollado

- **Listado `/prospectos`:** filtros por etapa («En gestión» por defecto, «Todas», cada
  etapa, «Inactivos (N)»), canal, responsable y calificación; búsqueda; columnas
  calificación, etapa, responsable, venta mensual, **próximo compromiso** y **último
  contacto** (en rojo si lleva 14+ días); insignia de observaciones abiertas; tarjetas en
  móvil.
- **Panel de detalle** (`ProspectoDetalleDrawer`): calificación, responsable, etapa clicable
  (con motivo al pasar a Perdido), inactivar / reactivar, observaciones, registrar
  actividad, compromisos, edición de datos, eliminar e historial.
- **Cotizaciones del prospecto y productos de interés** (reincorporados en el panel tras el
  merge): lista de cotizaciones con enlace a cada una y «+ Nueva cotización» (abre
  `/cotizaciones?nueva=1&prospecto=ID`), y los productos del catálogo marcables como de
  interés.
- **Retroalimentación y degustación en la ficha del prospecto** (entre «Productos de interés»
  y «Datos»): se pueden registrar varias, cada una con **producto** (lista del catálogo o
  «General», para comentarios sobre los productos en conjunto), tipo, calificación 1–5 y
  comentario. Se guardan en `producto_feedback` con `prospecto_id`; `producto_id` null =
  «General». La ficha del producto sigue mostrando sus opiniones (con el nombre del
  prospecto) pero **ya no permite crearlas**: se registran desde el prospecto. En las
  tarjetas de producto, interesados y calificación promedio (las «General» no cuentan para
  ningún producto). **Dashboard:** «Productos nuevos» muestra interesados y promedio.
- **Canal define los precios:** el formulario del prospecto (alta rápida, alta completa,
  Funnel y panel de detalle) ya no pregunta «Tipo de cliente (precios)». La lista de precios
  de las cotizaciones sale de `canales.tipo_cliente_codigo` (cotizaciones aún permite
  cambiar el tipo en cada cotización). Canales: Distribuidor, Tienda, Mayorista, Grandes
  Superficies, HORECA, Corporativo y Consumidor Final (seed `005_canales_nuevos.sql`).
  Mayorista usa por ahora la lista de Distribuidor.
- **Supervisión:** KPI «Contactos con clientes» y «Avances en el funnel» y la columna
  «Contactos (N d)» de la cartera salen del historial `prospectos.actividad`; la bitácora
  enlaza a la ficha del prospecto, producto o cotización (`?abrir=ID`).
- Migración `20261024090000_crear_ficha_prospecto.sql`: `prospecto_actividad` (hoy sin uso),
  `prospecto_productos` y `producto_feedback` (RLS + `revoke`).

### API

| Método | Ruta | Quién |
|---|---|---|
| `PATCH` | `/api/prospectos/[id]` | `accion`: datos, calificación, responsable, inactivar, reactivar, actividad. Editar = `editar` o ser el responsable; reasignar = además `asignar` |
| `DELETE` | `/api/prospectos/[id]` | Quien puede editar; borra también sus compromisos |
| `GET` | `/api/prospectos/[id]/relacionados` | Acceso a Prospectos: cotizaciones, productos de interés y retroalimentación del prospecto |
| `POST` | `/api/prospectos/[id]/feedback` | Quien puede editar el prospecto: `{ producto_id | null, tipo, calif, texto }` (null = General) |
| `POST` | `/api/prospectos/[id]/interes` | Quien puede editar: marca / quita un producto |
| `GET` | `/api/productos/[id]/seguimiento` | Interesados y opiniones |
| `POST` | `/api/productos/[id]/feedback` | `editar` o `asignar` |

### Historial

La app escribe en `prospectos.actividad` (lista jsonb `{f, t, x, u}`, máx. 300 entradas).
Se agrega una entrada al registrar actividad, cambiar de etapa («Pasó a X · motivo», también
por una cotización enviada o aceptada), inactivar / reactivar («Estado») y cumplir un
compromiso («Cumplido: …»).

## Decisiones

| Tema | Decisión | Alternativa descartada |
|---|---|---|
| Historial | `prospectos.actividad` (jsonb) | Tabla `prospecto_actividad`: se creó en la migración, pero ningún código la usa. Pendiente de decidir si se elimina con una migración nueva |
| Interés y opiniones | Tablas `prospecto_productos` y `producto_feedback` | Guardarlos solo en jsonb |
| Pantalla al abrir | `ProspectoDetalleDrawer` en Prospectos y Funnel | Mantener también `ProspectoFicha` |
| Crear compromiso y cotización desde la ficha | Enlace al módulo con el prospecto preseleccionado | Duplicar los formularios dentro de la ficha |
| Compromiso cumplido | Entra al historial y a la bitácora | Solo bitácora |

## Novedades respecto al as-is

- Persistencia en Postgres; permisos revalidados en el servidor.
- «Nueva cotización» abre el módulo (no un modal sobre la ficha).
- Borrar un prospecto no borra sus cotizaciones (quedan con el nombre del cliente).

## Cómo probar / operar

1. Tener aplicadas las migraciones `20261022223000` (columna `actividad`) y `20261024090000`.
2. `/prospectos`: filtrar, abrir un prospecto, calificar, cambiar de etapa (probar Perdido),
   registrar actividad, marcar productos de interés, inactivar y reactivar.
3. Crear una cotización desde «+ Nueva cotización» y volver: debe aparecer en la lista del
   prospecto.
4. `/productos`: abrir un producto con interesados y agregar una opinión.
5. `/supervision`: los KPI de contactos y avances reflejan lo registrado.

## Archivos clave

- `supabase/migrations/20261024090000_crear_ficha_prospecto.sql`
- `src/components/ProspectoDetalleDrawer.tsx`, `src/components/ProspectosPanel.tsx`
- `src/app/api/prospectos/[id]/` (`route.ts`, `etapa`, `interes`, `relacionados`, `observaciones`)
- `src/lib/ficha-prospecto.ts`, `src/lib/actividad.ts`, `src/lib/productos-seguimiento.ts`
- `src/app/api/productos/[id]/seguimiento`, `src/app/api/productos/[id]/feedback`

## Fuera de alcance

- Fusionar prospectos duplicados.
- Varios contactos por prospecto (tabla `contactos`; ver 04-prospectos).
