# Preguntas abiertas

Decisiones de negocio que el as-is no resuelve y que se dejaron como en el original.

| # | Pregunta | Dónde afecta | Estado hoy |
|---|---|---|---|
| 1 | ¿Qué significa el tipo de caja A/B/C y debe afectar precio o despacho? | Cotizaciones | Obligatorio en la versión final; no cambia nada. |
| 2 | ¿Los % por tipo de cliente (35 / 28 / 20 / 18 / 12 / 0) son la política real? | Cotizaciones, Productos, Supervisión | Valores de referencia del seed. |
| 3 | ¿Debe enlazarse el cliente de una venta con un prospecto (por NIT o nombre)? | Ventas, Dashboard | Texto libre; la plantilla trae NIT pero no se usa. |
| 4 | ¿Puede el supervisor mover etapas de todo el funnel (acción `asignar`)? | Funnel | Solo si es el responsable (como el as-is). |
| 5 | ¿El comercial ve solo sus prospectos o todos? | Prospectos, Funnel | Todos ven todos (como el as-is). |
| 6 | ¿El comercial puede asignar el responsable al crear un prospecto? | Prospectos | Sí, como el as-is. |
| 7 | ¿Se mantiene la barra rápida de alta de prospectos? | Prospectos | Se mantiene. |
| 8 | ¿Cuánto tiempo se conserva la bitácora? | Supervisión | Sin límite. |
| 9 | ¿Eliminar productos o solo «descontinuar»? | Productos | Borrado real, como el as-is. |
| 10 | ¿Se despliega solo desde `Wandresp2/paramo` o también desde la cuenta `sergioserrano309`? `AGENTS.md` dice que `origin` es el único destino. | Git / Vercel | Existe el remoto `mio` para Vercel; falta actualizar la regla. |
