# Dashboard — resumen comercial del día (Hito 10)

## Desarrollado

- `/dashboard` operativo para ambos roles. Saludo con el primer nombre y la fecha.
- **Estado vacío** (sin prospectos, ventas ni compromisos): tarjeta de bienvenida y los 4
  pasos para empezar (catálogo, prospecto, compromiso, ventas).
- **KPI**: ventas del último mes cargado (con variación vs el mes anterior), acumulado del
  año (vs el mismo período del año anterior), pipeline ponderado (venta mensual ×
  probabilidad de la etapa) y compromisos vencidos.
- **Agenda** (vencidos y próximos 7 días, hasta 8) y **Funnel comercial** (cantidad y valor
  por etapa, tasa de cierre).
- **Ventas mensuales** (últimos 12 meses cargados) y **Top clientes / productos / mix por
  canal** del último mes cargado.
- **Alertas**: prospectos sin contacto (14+ días), clientes que dejaron de comprar
  (compraron en los 3 meses previos y no en el último) y productos nuevos (desarrollo /
  lanzamiento).
- **Observaciones del supervisor** (solo comercial): responder y marcar atendida desde aquí.
- **Descuentos / precios por aprobar** (supervisor) y **respuestas del supervisor**
  (comercial), enlazando a Cotizaciones y Productos.
- Gráfica de barras en SVG propio (`BarChart`), sin librería.

Sin migración propia: usa lo que crearon los demás módulos. Todo se calcula en el servidor
(`src/lib/dashboard.ts`) con los agregados SQL de ventas.

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Datos | Agregados en el servidor; el navegador recibe cifras | Volcar colecciones completas (anti-patrón del as-is) |
| Tops y churn | `ventas_resumen` por mes de referencia y por los 3 meses previos | Recorrer todas las filas en la aplicación |
| Gráfica | SVG propio | Librería de gráficos (peso y dependencia) |
| «Ver con datos de ejemplo» | No se porta | Modo demo del as-is (datos ficticios en el navegador) |
| Aprobar precios en bloque | No se porta | Botón «Aprobar todos» del as-is |

## Novedades respecto al as-is

- «Productos nuevos» muestra interesados y calificación promedio; «Prospectos sin contacto»,
  empresas y productos enlazan a su ficha.
- «Prospectos sin contacto» usa `ultimo_contacto` (se actualiza al crear el prospecto, al
  registrar actividad, al cumplir un compromiso y al cambiar la etapa por cotización).
- No hay modo demo.

## Cómo probar / operar

1. Con todas las migraciones y seeds aplicados, entrar como `supervisor` y como `comercial`.
2. Sin datos: ver el estado vacío y los 4 pasos.
3. Con datos (prospectos, compromisos, una carga de ventas): revisar KPI, agenda, funnel,
   ventas mensuales, tops y alertas.
4. Como comercial con una observación abierta: aparece arriba y se puede atender.
5. Con una cotización pendiente de descuento: el supervisor ve «Descuentos por aprobar».

## Archivos clave

- `src/app/(app)/dashboard/page.tsx`, `src/lib/dashboard.ts`
- `src/components/ObservacionesDashboard.tsx`, `src/components/PanelAprobaciones.tsx`, `src/components/BarChart.tsx`

## Próximos posibles desarrollos (no están en el as-is)

- Filtro por responsable o por período en el Dashboard.
- Proyección de ventas con el pipeline ponderado.
