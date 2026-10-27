# Ventas — carga desde Excel y análisis (Hito 7)

## Desarrollado

- Módulo `/ventas` operativo: análisis por cliente / por producto con selector de período,
  carga de Excel con vista previa y meses cargados (reemplazar / eliminar).
- Migración `20261023130000_crear_ventas.sql`:
  - tabla `ventas` (una fila por línea del Excel; RLS + `revoke`);
  - vista `ventas_por_mes` (reemplaza a `ventas_meses` del inventario: se deriva);
  - función `cargar_ventas` (reemplazo atómico de los meses del archivo);
  - funciones `ventas_resumen` y `ventas_totales` (agregados en SQL).
- Plantilla `public/Plantilla_Ventas_Paramo.xlsx` (copia de `Plantilla_Ventas_Paramo_1.xlsx`
  de `pre-arquitectura/`, generada por `CRM_paramo.py`).
- Lector de Excel en el navegador (`xlsx` / SheetJS, importado bajo demanda).
- Ficha de **Productos**: ya muestra ventas a 12 meses, clientes que compran, serie mensual
  y principales clientes (y «ventas 12 m» en las tarjetas).

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/ventas/resumen?periodo=&por=&cliente=` | Acceso al módulo |
| `POST` | `/api/ventas/cargar` | `editar` (comercial), como el as-is |
| `DELETE` | `/api/ventas/meses/[mes]` | `editar` |
| `GET` | `/api/productos/[id]/ventas` | Acceso al módulo `productos` |

### Reglas (as-is)

- Una fila = un producto vendido a un cliente en una fecha. Obligatorias: fecha, cliente,
  producto, unidades y valor **o** precio unitario (valor = unidades × precio).
- Se ignoran las filas cuyo cliente empieza por «EJEMPLO».
- Si el mes ya existe, **se reemplaza completo**. El archivo puede traer varios meses.
- Productos que no están en el catálogo: opción «Agregarlos al catálogo» (línea «Otra»,
  PVP 0, estado activo; se completan en Productos).
- «Últimos 12 meses» son los últimos 12 meses **cargados**, no los últimos 12 calendario.
- Máximo 10.000 filas por archivo (recomendación de la plantilla, aquí se aplica).

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Almacenamiento | Una fila por línea de venta | Documentos de 1.500 filas (limitación de Firestore) |
| `ventas_meses` | Vista `ventas_por_mes` | Tabla propia (doble fuente de verdad) |
| Vista y volumen | Hoy se recalcula en cada lectura. Si crecen los años de facturas y el resumen se pide en cada pantalla, pasar a vista materializada refrescada al cargar el Excel | Dejar el `GROUP BY` completo en cada visita cuando el volumen ya pese |
| Cruce con productos | `producto_clave` (nombre normalizado) resuelto al consultar | FK `producto_id` fijada al cargar: queda desactualizada si el producto se crea o renombra después |
| Carga | RPC `cargar_ventas` atómica | Borrar e insertar por lotes desde la API (mes a medias si falla) |
| Agregados | En SQL (`ventas_resumen`); el cliente solo recibe totales | Volcar todas las filas al navegador (anti-patrón del as-is) |
| Clave de cruce | La calcula el servidor | Confiar en la que mande el navegador |

## Novedades respecto al as-is

- La plantilla trae una columna **NIT**, pero el as-is nunca la leía; aquí tampoco se guarda
  (el cliente es texto libre, no FK a prospectos). Pendiente de negocio si debe enlazar
  ventas con prospectos por NIT.
- Los clientes de ventas **no** se vinculan a la tabla de prospectos (igual que el as-is).
- Se valida de nuevo en el servidor cada fila (fecha real, longitudes, rangos).
- Se exponen negativos en unidades y valor (devoluciones/notas crédito); el as-is también
  los aceptaba.

## Cómo probar / operar

1. Aplicar la migración `20261023130000_crear_ventas.sql`.
2. Login `comercial` → `/ventas` → Descargar plantilla, llenarla y cargarla (ver la vista
   previa; probar un producto fuera de catálogo y un mes que ya existe).
3. Cambiar período y pestaña; expandir un cliente para ver sus productos.
4. Eliminar un mes (confirmar) y revisar `public.bitacora`.
5. En `/productos`, abrir una referencia con ventas: ver el seguimiento.
6. Login `supervisor`: ve el análisis y los meses, sin carga ni eliminación.

## Archivos clave

- `supabase/migrations/20261023130000_crear_ventas.sql`, `public/Plantilla_Ventas_Paramo.xlsx`
- `src/app/(app)/ventas/page.tsx`, `src/components/VentasPanel.tsx`
- `src/app/api/ventas/` (`resumen`, `cargar`, `meses/[mes]`), `src/app/api/productos/[id]/ventas`
- `src/lib/ventas.ts`, `src/lib/ventas-excel.ts`, `src/lib/ventas-periodo.ts`, `src/lib/texto.ts`

## Dependencias nuevas

- `xlsx` 0.20.3, instalado desde `cdn.sheetjs.com` (la versión del registro npm tiene
  vulnerabilidades conocidas sin parche). Solo lee archivos que el propio usuario sube.

## Vista `ventas_por_mes`

No guarda un resultado. Cada consulta agrupa `ventas` por mes. Con los meses que carga el equipo, ese agrupado es el mismo trabajo que haría la consulta a mano y no añade una espera propia.

Cuando el historial de ventas sea grande y Dashboard, Ventas o la ficha de producto pidan ese resumen seguido, hay que evitar recalcularlo en cada carga. La salida prevista es una vista materializada que se refresque al terminar `cargar_ventas` (y al borrar un mes), no una segunda tabla escrita a mano.

## Próximos posibles desarrollos (no están en el as-is)

- Enlazar ventas con prospectos (por NIT o nombre) para ver compras en la ficha del cliente.
- Cambio de `producto_clave` a FK cuando el catálogo esté estable.
- Importar directamente desde el sistema contable.
