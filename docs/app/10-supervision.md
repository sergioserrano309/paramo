# Supervisión — auditoría, observaciones, listas de precios y bitácora (Hito 9)

## Desarrollado

- Módulo `/supervision` (solo `supervisor`) con selector de período (7 / 30 / 90 días):
  - **KPI** del comercial: prospectos nuevos (y valor/mes potencial), avances en el funnel y
    negocios ganados, compromisos cumplidos / a tiempo, vencidos hoy, último registro e
    ingreso.
  - **Actividad diaria** del comercial (últimos 14 días) a partir de la bitácora.
  - **Observaciones**: crear (supervisor), responder y marcar atendida (comercial), retirar
    las propias abiertas.
  - **Cartera bajo seguimiento**: prospectos activos en pipeline, primero los que no tienen
    próximo paso o llevan más tiempo sin contacto; botones «Observar» y «Asignar».
  - **Listas de precios**: % de la lista general por tipo de cliente (acción `usuarios`).
  - **Bitácora** con filtros por usuario, acción y texto (200 más recientes).
  - Panel de **descuentos y precios por aprobar** (enlaza a Cotizaciones / Productos).
- Migración `20261023170000_crear_observaciones.sql`: tabla `observaciones`.
- La bitácora ya la escriben: Productos, Cotizaciones, Ventas, Compromisos, Observaciones,
  creación de prospectos, cambio de etapa (Funnel), ingreso y salida.

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/observaciones` | Ambos roles |
| `POST` | `/api/observaciones` | `observar` (supervisor) |
| `POST` | `/api/observaciones/[id]` | `editar` (comercial): marca atendida con respuesta |
| `DELETE` | `/api/observaciones/[id]` | `observar` y ser el autor, mientras esté abierta |
| `PATCH` | `/api/config/precios` | `usuarios` (supervisor) — `{ descuentos: { tipo: % } }` (0–80, paso 0,5) |
| `GET` | `/api/bitacora?rol=&accion=&q=` | `auditar` (supervisor) |

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Lista de precios | Se guarda en `tipos_cliente.descuento_pct_default` | Tabla de configuración aparte |
| Bitácora | Escrita desde la API de cada módulo con `registrarBitacora` (no por trigger) | Triggers en cada tabla (no ven el usuario de la app) |
| Agregados | En el servidor; el navegador recibe cifras | Cargar toda la bitácora / cartera y calcular en el cliente |
| «Asignar tarea» | Enlaza a `/compromisos?nuevo=1` (con el prospecto) | Modal de compromiso duplicado dentro de Supervisión |
| Usuarios | Se gestionan en `/usuarios` (alta Auth + `profiles`) | Panel de usuarios dentro de Supervisión (as-is local/online) |

## Novedades respecto al as-is

- «Contactos con clientes», «Contactos (N d)» y «Avances en el funnel» salen del historial de
  los prospectos (`prospecto_actividad`), como el as-is.
- El detalle de la bitácora enlaza a la ficha del prospecto, producto o cotización
  (`?abrir=ID`); si el registro ya se eliminó, la pantalla abre sin ficha.
- Se registra «Ingreso» y «Salida»; no hay PIN ni modo local/online del as-is.
- Las listas de precios y la aprobación de precios/descuentos viven aquí y en
  Dashboard, no en Productos (como en el as-is).

## Cómo probar / operar

1. Aplicar la migración `20261023170000_crear_observaciones.sql`.
2. Login `supervisor` → `/supervision`: cambiar período; crear una observación general y
   otra sobre un prospecto; probar «Asignar tarea» y «Asignar» desde la cartera.
3. Login `comercial` → Dashboard: ver la observación, responderla y marcarla atendida;
   luego el supervisor la ve atendida con la respuesta.
4. Editar las listas de precios y revisar que una cotización nueva use el % nuevo.
5. Revisar la bitácora: filtros y búsqueda; confirmar que el comercial no accede a `/supervision`.

## Archivos clave

- `supabase/migrations/20261023170000_crear_observaciones.sql`
- `src/app/(app)/supervision/page.tsx`, `src/components/SupervisionPanel.tsx`
- `src/components/ObservacionesLista.tsx`, `src/components/PanelAprobaciones.tsx`, `src/components/BarChart.tsx`
- `src/app/api/observaciones/`, `src/app/api/config/precios/`, `src/app/api/bitacora/`
- `src/lib/supervision.ts`, `src/lib/observaciones.ts`, `src/lib/bitacora-consulta.ts`, `src/lib/aprobaciones.ts`, `src/lib/bitacora.ts`


## Próximos posibles desarrollos (no están en el as-is)

- Exportar la bitácora a CSV.
- Retención / archivado de la bitácora (hoy crece sin límite).
- Cambio de rol de usuarios desde `/usuarios`.
