# Compromisos — agenda comercial (Hito 8)

> **Merge con main:** la pantalla y la API vigentes están en
> [06-compromisos.md](./06-compromisos.md). La tabla es
> `20261022193000_crear_compromisos.sql`. La migración que volvía a crear
> `compromisos` se eliminó del repo: no agregaba columnas. Lo que sí quedó
> de este hito, adaptado a esa tabla, es `POST /api/compromisos/[id]/hecho`
> y los enlaces `?nuevo=` / `?prospecto=`. El texto de abajo describe el
> diseño de la otra rama; no es la pantalla que abre `/compromisos`.

## Desarrollado

- Módulo `/compromisos` operativo: filtros (Pendientes / Vencidos / Hoy / 7 días /
  Asignadas / Hechos) con contadores, selector de responsable, agenda agrupada por fecha
  (Vencidos, Hoy, Mañana, Próximos 7 días, Más adelante, Hechos) y modal de alta / edición
  con atajos de fecha.
- Supervisor: tarjetas de seguimiento por persona (pendientes, vencidos, % cumplido a 30
  días, % a tiempo, próximo compromiso) y asignación de tareas a cualquier usuario activo.
- La tabla de agenda no se volvió a crear. Sigue siendo
  `20261022193000_crear_compromisos.sql`.

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/compromisos` | Acceso al módulo (el comercial no recibe los de un supervisor) |
| `POST` | `/api/compromisos` | `editar` o `asignar`; solo el supervisor elige responsable |
| `PATCH` | `/api/compromisos/[id]` | Quien puede editarlo (ver reglas) |
| `DELETE` | `/api/compromisos/[id]` | Quien puede editarlo |
| `POST` | `/api/compromisos/[id]/hecho` | Quien puede marcarlo — `{ hecho: boolean }` |

### Reglas (as-is `visC`, `canToggleC`, `canEditC`)

- El supervisor ve todo; el comercial no ve los compromisos cuyo responsable es un supervisor.
- Marcar hecho: el supervisor solo los suyos; el comercial lo que ve (lo suyo), también lo
  que le asignó el supervisor.
- Editar / eliminar: el supervisor los que creó o le tocan; el comercial **solo los que él
  creó** (lo asignado por el supervisor no se edita; ver 14-permisos-y-visibilidad).
- Al crear, el comercial queda como responsable; el supervisor elige (por defecto, el
  primer vendedor). Si el supervisor asigna a otra persona queda marcada «Asignada por
  supervisor». Al editar, el comercial no puede reasignar.
- Marcar hecho guarda `hecho_en` (hoy, Bogotá); si es posterior a la fecha límite se ve
  «(tarde)». Si hay prospecto, ese prospecto actualiza `ultimo_contacto` (alimenta la
  alerta «stale» del funnel).
- «Hechos» carga solo los últimos 90 días (`DIAS_HISTORIAL`); el cumplimiento usa 30.

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Responsable | FK obligatoria a `profiles` | Vacío = «el vendedor» resuelto en código (as-is) |
| Tipo | `CHECK` con los 10 valores del as-is | Tabla de catálogo |
| Historial | Pendientes + hechos de 90 días | Volcar todo el historial |
| Bitácora | Crear/asignar, editar/reasignar, eliminar y marcar hecho / reabrir (con días de retraso), como el as-is | — |

## Novedades respecto al as-is

- Persistencia Postgres + API; permisos validados en el servidor.
- Al cumplir un compromiso con prospecto, el historial del prospecto anota «Cumplido: …» y se
  actualiza `ultimo_contacto` (ver 12-ficha-prospecto).
- El «próximo compromiso» ya aparece en la tarjeta del funnel y en el listado de prospectos,
  y los compromisos del prospecto en su ficha.
- El compromiso automático «Enviar cotización» no existe en el as-is: no se crea.

## Cómo probar / operar

1. Aplicar la migración `20261022193000_crear_compromisos.sql` (la de main).
2. Login `comercial` → `/compromisos`: agendar con los atajos de fecha, marcar hecho,
   editar, eliminar; filtrar por vencidos / hoy / 7 días.
3. Login `supervisor`: ver las tarjetas por persona; asignar una tarea a un comercial
   («Asignada por supervisor»); verificar que el comercial la ve y la puede marcar.
4. Verificar que un comercial **no** ve compromisos de un supervisor.

## Archivos clave

- `supabase/migrations/20261022193000_crear_compromisos.sql`
- `src/app/(app)/compromisos/page.tsx`, `src/components/CompromisosPanel.tsx`
- `src/app/api/compromisos/` (`route.ts`, `[id]/route.ts`, `[id]/hecho`)
- `src/lib/compromisos.ts`, `src/lib/fechas.ts`
- `src/config/compromisos.ts`, `src/lib/types/compromiso.ts`

## Fuera de alcance (siguientes hitos)

- Modal de compromiso embebido en la ficha del prospecto: «Agendar» abre este módulo con el
  prospecto preseleccionado.

## Próximos posibles desarrollos (no están en el as-is)

- Recordatorios por correo o WhatsApp de compromisos vencidos.
- Compromisos recurrentes.
