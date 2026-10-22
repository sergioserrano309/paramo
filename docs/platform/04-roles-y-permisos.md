# Roles y permisos (as-is → to-be)

Fuente: `pre-arquitectura/index_12 (1).html` (congelada). Este documento es la matriz
de autorización del CRM Páramo Snacks.

## Roles canónicos

| Rol | Capacidades base en el as-is (`ROLES[…].can`) |
|---|---|
| `comercial` | `editar` |
| `supervisor` | `observar`, `asignar`, `auditar`, `usuarios` |

Mensaje del as-is cuando el supervisor intenta “editar” como vendedor: *«El perfil
Supervisor audita; los registros los edita el comercial.»*

## Acciones de negocio

| Acción | Quién | Significado operativo |
|---|---|---|
| `editar` | comercial | Crear/editar gestión del día a día (prospectos, agenda, cotizaciones, carga de ventas, responder observaciones). |
| `observar` | supervisor | Dejar observaciones sobre prospectos; retirar las propias abiertas. |
| `asignar` | supervisor | Asignar responsables/tareas, aprobar descuentos > 5 %, aprobar precios especiales. |
| `auditar` | supervisor | Ver bitácora / supervisión completa. |
| `usuarios` | supervisor | Configurar usuarios (PIN local en as-is) y % de precio por tipo de cliente. |

## Acceso a módulos (navegación)

En el as-is: se filtran vistas con `only` (solo Supervisión exige `supervisor`).

| Módulo | Comercial | Supervisor |
|---|---|---|
| Dashboard | Sí | Sí |
| Supervisión | **No** (`only: 'supervisor'`) | Sí |
| Usuarios (to-be Next.js) | **No** | Sí |
| Prospectos | Sí | Sí |
| Funnel | Sí | Sí |
| Compromisos | Sí | Sí |
| Cotizaciones | Sí | Sí |
| Productos | Sí | Sí |
| Ventas | Sí | Sí |

Si un comercial intenta abrir Supervisión, el as-is fuerza `view = 'dashboard'`. En la
app Next.js: menú oculto + redirect/403 en servidor. Lo mismo aplica a `/usuarios`.

## Matriz por módulo (detalle as-is)

### Dashboard

- Ambos ven KPIs / agenda / resúmenes.
- Comercial: panel de observaciones abiertas del supervisor; atajos N/C si `editar`.
- Supervisor: banner de perfil; paneles de descuentos y precios por aprobar (`asignar`).

### Supervisión (solo supervisor)

- Bitácora (`auditar`).
- Gestión de usuarios / PIN en modo local (`usuarios`) — en el as-is; en Next.js el alta
  de usuarios Auth + `profiles` vive en el módulo `/usuarios` (ver `docs/app/03-usuarios.md`).
- Configuración de % por tipo de cliente (`usuarios` + `pctForm`).

### Usuarios (solo supervisor, to-be)

- Crear y listar usuarios del CRM (`acción usuarios`).
- Alta: Supabase Auth + fila en `profiles` con rol `comercial` o `supervisor`.

### Prospectos / Funnel

- Crear prospecto: `editar` **o** `asignar` (`canCreateP`).
- Editar ficha: comercial con `editar`, **o** responsable del prospecto = yo (`canEditP`).
  El supervisor **no** tiene `editar`; solo edita si es el `responsable` (caso raro) o asigna.
- Asignar responsable: `canEditP` **o** `asignar`.
- Observaciones: crear/retirar propias → `observar`; responder/atender → `editar`.

### Compromisos

- Ver: comercial ve compromisos no “de supervisor”; supervisor ve todos (`visC`).
- Crear: `editar` o `asignar`.
- Editar/toggle: reglas de ownership (`canEditC` / `canToggleC`).

### Cotizaciones

- Crear/editar: `editar` o ownership del prospecto/cotización.
- Descuento > 5 % (`DESC_MAX`): comercial solicita aprobación; supervisor aprueba/rechaza (`asignar`).
- Supervisor al generar final con desc > 5 %: queda autoaprobado.

### Productos

- Crear/editar catálogo: `editar` o `asignar` (`canEditProd`).
- Precios por tipo: comercial propone (`preciosPend`); supervisor aprueba (`asignar`).
- Importar 21 referencias del sitio: quien pueda editar productos.

### Ventas

- Ambos consultan.
- Cargar Excel: `editar` (comercial).

## Reglas de implementación (to-be)

1. **UI:** oculta módulos/acciones que el rol no usa.
2. **Rutas:** `/supervision` y `/usuarios` solo `supervisor` (servidor).
3. **API:** cada escritura llama `assertCan` / `requireApiPermission` tras reconsultar `profiles`.
4. Ownership fino (responsable de prospecto, etc.) se aplica **además** de `can`, cuando
   existan las tablas de dominio (no solo el rol).

## Fuera de alcance del Hito 2

- Enforcement de ownership fila a fila (requiere tablas `prospectos`, etc.).
- Políticas RLS por rol (el proyecto autoriza en API + `service_role`).
