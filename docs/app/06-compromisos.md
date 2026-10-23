# Compromisos — agenda

## Desarrollado

- `/compromisos` deja de ser placeholder.
- Misma tabla `compromisos` (sin migración nueva).
- API (sesión + módulo `compromisos`, zod, tope de body, rate limit):
  - `POST /api/compromisos` — alta.
  - `PATCH /api/compromisos/[id]` — editar y/o marcar hecho.
  - `DELETE /api/compromisos/[id]` — eliminar.
- Pantalla:
  - Botón **+ Nuevo compromiso**.
  - Supervisor: dos tarjetas, **Comerciales** y **Supervisores**. Un clic filtra
    la lista; otro clic en la misma vuelve a mostrar los dos grupos.
  - Filtros: Pendientes, Vencidos, Hoy, 7 días, Asignadas por mí (supervisor) o
    Asignadas (comercial), Hechos.
  - Lista agrupada: Vencidos, Hoy, Mañana, Próximos 7 días, Más adelante.
    Hechos, aparte (máximo 100 en pantalla).
  - Checkbox para cumplir o reabrir, **Editar**, y **Eliminar** con confirmación.
  - El nombre del prospecto abre la ficha ya existente (ver + cambiar etapa).
- Formulario: qué hay que hacer, tipo (default Llamada), fecha límite (default
  mañana) con atajos Hoy / Mañana / En 3 días / En 1 semana / En 2 semanas,
  prospecto opcional, notas en varias líneas.
- El supervisor elige responsable en una lista (persona activa, nombre y rol).
  Al abrir queda elegido él: el botón dice **Agendar**. Si elige a otra persona,
  **Asignar**. En edición, **Guardar**.
- El comercial no ve ese campo: el compromiso queda a su nombre y el botón dice
  **Agendar**.
- Al marcar cumplido, si hay prospecto, `ultimo_contacto` pasa a hoy (Bogotá).
  Reabrir no revierte esa fecha. No se escribe bitácora.

### Quién ve y quién toca

| Acción | Comercial | Supervisor |
|---|---|---|
| Ver | Solo compromisos con `responsable_id` = él | Todos |
| Tarjetas de rol | No | Sí |
| Crear | Para sí mismo | Para cualquier persona activa |
| Marcar hecho | Los suyos | Solo si él es el responsable |
| Editar / eliminar | Los suyos | Si los creó o si él es el responsable |

La API repite estas reglas. Ocultar el checkbox no autoriza.

## Decisiones

| Tema | Decisión | Por validar |
|---|---|---|
| Alcance | Solo `/compromisos`. Dashboard, ficha y Supervisión no agendan todavía | — |
| Tarjetas | Dos bloques por rol (todos los comerciales / todos los supervisores), no una tarjeta por persona | **Sí.** Con varios usuarios puede hacer falta una tarjeta por persona |
| Lectura del comercial | Solo lo suyo. No ve compromisos de supervisores ni de otros comerciales | — |
| Quién lo hace | Lista desplegable. Default: quien abre el formulario | — |
| Prospecto | Opcional, como el as-is («— Ninguno —») | **Sí.** Valorar si debe ser obligatorio |
| Asignadas por mí | `creado_por` = yo y el responsable es otra persona | — |
| Asignadas (comercial) | Flag `asignado` (se las dejó un supervisor) | — |
| `asignado` | Se marca al crear, o cuando el supervisor cambia el responsable. Una edición de título o notas no lo recalcula | — |
| Cumplir | Actualiza `ultimo_contacto` del prospecto. Sin bitácora ni actividad | — |
| Responsable vacío | Si `responsable_rol` es null, la tarjeta Comerciales lo cuenta (igual que el as-is) | — |
| Tope de lista | 2000 filas, fecha ascendente. Si se supera, se cortan las fechas más lejanas | — |
| Ficha | El enlace abre el drawer actual. La sección Compromisos de la ficha sigue en «Próximamente» | — |

## Novedades respecto al as-is

- Persistencia en Postgres vía API (`service_role`).
- Las tarjetas agrupan por rol. En el HTML había una tarjeta por usuario
  (en la prueba local, dos personas).
- El comercial no puede cambiar el selector a otro comercial.
- «¿Quién lo hace?» es una lista, no una fila de botones.
- Notas es un área de texto.
- Eliminar pide confirmación.
- Al cumplir se actualiza último contacto y no se escribe bitácora.
- Prospectos y Funnel muestran el próximo pendiente en cuanto exista una fila.

## Cómo probar / operar

1. Migración `20261022193000_crear_compromisos.sql` aplicada. Sin seed.
2. Tener al menos un comercial, un supervisor y un prospecto.
3. Supervisor → `/compromisos`: dos tarjetas. Nuevo compromiso, dejar el
   responsable en sí mismo (**Agendar**) y otro asignado a un comercial
   (**Asignar**).
4. La tarea propia cae en Supervisores; la asignada, en Comerciales. Clic en
   la tarjeta filtra; segundo clic muestra ambas.
5. Filtros Pendientes, Vencidos, Hoy, 7 días, Asignadas por mí, Hechos.
6. Marcar hecho en uno con prospecto: checkbox, toast, y en Prospectos el
   último contacto de ese prospecto queda en hoy. Reabrir no lo borra.
7. Editar y eliminar (la segunda pregunta confirma).
8. El nombre del prospecto abre la ficha.
9. Comercial: no ve tarjetas ni «¿Quién lo hace?». Solo sus compromisos,
   incluidos los que el supervisor le asignó. No ve los del supervisor.
10. Móvil ~360 px: tarjetas en columna, filtros que saltan de línea, botones
    de al menos 44 px.

## Archivos clave

- `src/app/(app)/compromisos/page.tsx`
- `src/components/CompromisosPanel.tsx`
- `src/app/api/compromisos/route.ts`
- `src/app/api/compromisos/[id]/route.ts`
- `src/lib/compromisos.ts`, `src/lib/compromisos-agenda.ts`, `src/lib/can.ts`
- `src/config/compromisos.ts`
- `supabase/migrations/20261022193000_crear_compromisos.sql` (ya existía)
