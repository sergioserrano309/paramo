# Hallazgos — auditoría del as-is frente a lo construido

Fuente: `pre-arquitectura/` (HTML, script Python, plantilla Excel, logo) cruzado con la
app Next.js. Primera auditoría: 2026-10-23; actualizada tras el hito 11 (ficha del prospecto)
y el hito 12 (shell). **No se probó en pantalla ni contra una base real** (ver «Riesgos sin
verificar»).

## 1. Cobertura por módulo

| Módulo | Estado | Qué falta frente al original |
|---|---|---|
| Login / usuarios | Cambió a propósito | El as-is usaba PIN local / Firebase; ahora Supabase Auth + `profiles`. Sin modo demo. |
| Prospectos | Completo | Filtros, columnas, ficha completa. «Agendar» y «Nueva cotización» abren el módulo con el prospecto (no un modal sobre la ficha). |
| Funnel | Completo | — |
| Compromisos | Completo | — |
| Cotizaciones | Completo | — |
| Productos | Completo | El botón «Importar 21 referencias» se sustituyó por el seed. |
| Ventas | Completo | Sin modo local. |
| Supervisión | Completo | El panel de usuarios del as-is se hace en `/usuarios`. |
| Dashboard | Completo | Sin modo demo ni «Aprobar todos». |
| Transversal | Completo | Falta el banner informativo «Perfil Supervisor» y el indicador «Conectado · guardado automático» (no aplican). El tema se aplica tras cargar (un instante en claro). |

## 2. Diferencias deliberadas respecto al as-is

- Precio de las líneas de cotización: lo recalcula el servidor (antes el navegador).
- Número de cotización: lo asigna la base (antes «máximo + 1» en el navegador).
- Carga de ventas: atómica y reemplaza el mes completo en una transacción.
- Agregados (ventas, KPI, bitácora) se calculan en SQL / servidor; el navegador no recibe
  colecciones completas.
- El tipo de cliente por canal y los % de la lista de precios están en tablas, no en el código.
- La aprobación de descuentos y precios se decide en su módulo; los paneles del Dashboard y
  de Supervisión solo avisan y enlazan.
- Historial del prospecto, productos de interés y retroalimentación son tablas (en el as-is,
  arreglos dentro del documento).
- «Agendar» y «Nueva cotización» desde la ficha navegan al módulo en lugar de abrir un modal.

## 3. Incoherencias del propio as-is (heredadas)

1. La plantilla de ventas trae la columna **NIT**, pero el HTML nunca la lee.
2. **Tipo de caja** (A/B/C) es obligatorio en la versión final y no afecta el precio.
3. Los % por tipo de cliente se describen como «valores de referencia a reemplazar».
4. `valor` del producto exige `PVP > 0` aunque el campo diga `min=0`.
5. La importación de las 21 referencias crea productos sin precios especiales, aunque el alta
   manual los exige.

## 4. Defectos encontrados y corregidos en la auditoría

| # | Defecto | Corrección |
|---|---|---|
| 1 | `/cotizaciones` enviaba al navegador NIT, teléfono y correo de hasta 1.000 prospectos solo para el PDF (AGENTS §3.6). | Esos datos se piden al descargar un PDF; el listado ya no los trae. |
| 2 | El filtro de texto de la bitácora se interpolaba en un `.or(...)` de PostgREST. | Se sanean `, ( ) "` antes de armar el filtro. |
| 3 | Código muerto: `ModulePlaceholder`, funciones y tipos sin uso, y el drawer «solo lectura» del Funnel. | Eliminados. |
| 4 | Marcar un compromiso hecho no quedaba en bitácora (el as-is sí). | Ahora se registra, con los días de retraso. |

## 5. Riesgos sin verificar (revisar primero al probar)

- **Supervisión y menú:** usan filtros sobre datos relacionados (`!inner` + `neq` sobre el rol
  del responsable). Si el servicio responde con error, Supervisión muestra «No se pudieron
  cargar los indicadores» y el menú no mostrará contador de compromisos.
- **Carga de Excel y PDF:** corren en el navegador; no se ejecutaron.
- **Funciones SQL** (`cargar_ventas`, `ventas_resumen`, `ventas_totales`, trigger de número
  de cotización): revisadas a mano, no ejecutadas.
- **Descuento con decimales:** la base guarda 1 decimal (`numeric(4,1)`); un valor como 5,25
  se redondea a 5,3 mientras el total del formulario usó 5,25. El campo avanza de 0,5 en 0,5,
  pero se puede teclear otro valor.
- **Rendimiento del menú:** el layout hace 4 consultas de conteo por cada navegación.
- **Bitácora:** guarda nombres de cliente y totales de cotización en el detalle. Solo la lee
  el supervisor; no hay política de retención.
- **Límites en memoria:** el rate limit es por instancia (limitación de Vercel serverless).
- **Dependencia `xlsx`** instalada desde `cdn.sheetjs.com`; si ese sitio no responde, falla
  `npm install`.
