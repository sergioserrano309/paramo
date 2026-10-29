# Cotizaciones — borradores, aprobación de descuento y PDF (Hito 6)

## Desarrollado

- Módulo `/cotizaciones` operativo: KPI, filtros (Activas / Por aprobar / Cerradas /
  Todas), tabla, drawer con el formulario completo y acciones por estado.
- Migración `20261023110000_crear_cotizaciones.sql`: tabla `cotizaciones` (RLS + `revoke`,
  trigger de numeración y de `actualizado_en`) y columna `canales.tipo_cliente_codigo`.
- Seed `supabase/seed/004_canal_tipo_cliente.sql` (tipo de cliente por defecto de cada canal); los canales vigentes y su tipo los fija `005_canales_nuevos.sql`.
- PDF en el navegador (`jspdf` + `jspdf-autotable`, cargados bajo demanda) con logo
  (`public/logo-paramo.jpg`, copia del as-is), marca de agua si no es versión final y datos
  de marca en `src/config/empresa.ts`.

### Estados (as-is `Q_EST`)

`borrador` → `pendiente` (descuento > 5 % de un comercial) → `final` (o `rechazada` →
se corrige y vuelve a intentar) → `enviada` → `aceptada` / `no_aceptada`. Desde
`enviada`, `aceptada` o `no_aceptada` se puede «Crear nueva versión» (vuelve a `borrador`).

### API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/cotizaciones` | Acceso al módulo |
| `POST` | `/api/cotizaciones` | `editar`, o responsable del prospecto elegido |
| `PATCH` | `/api/cotizaciones/[id]` | `editar`, o responsable del prospecto (o creador si el prospecto ya no existe); solo en `borrador`/`pendiente`/`rechazada`/`final` |
| `DELETE` | `/api/cotizaciones/[id]` | Igual que PATCH, solo en `borrador` |
| `POST` | `/api/cotizaciones/[id]/estado` | `aprobar` / `rechazar`: `asignar`. `enviar` / `aceptar` / `no_aceptada` / `nueva_version`: quien puede editar |
| `POST` | `/api/cotizaciones/[id]/descarga` | Acceso al módulo; deja constancia en bitácora y devuelve los datos de contacto del cliente para el PDF (no viajan con el listado) |

### Reglas (as-is)

- Descuento ≤ 5 % → se genera la versión final directo. Descuento > 5 %: el comercial
  queda `pendiente` y el supervisor aprueba (puede bajar el % pero no subirlo) o rechaza;
  si lo genera el supervisor, queda autoaprobado.
- Versión final exige tipo de caja (A/B/C) en cada línea y PVP en cada producto.
- `version` sube al generar la versión final o al aprobar el descuento.
- **Tipo de cliente y fecha no se editan**: el tipo sale del prospecto (su canal) y la fecha es
  la del registro. Con el descuento **aprobado** la cotización queda bloqueada; se cambia
  con «Crear nueva versión», y si el % no cambia no se pide aprobación otra vez. El comercial
  solo edita cotizaciones de sus prospectos (ver 14-permisos-y-visibilidad).
- Al **marcar enviada**, el prospecto avanza a «Propuesta enviada» si estaba antes en el
  pipeline (nunca retrocede). Al **aceptar**, pasa a «Ganado» (`ganado_en`, `activo`).
- Los precios de las líneas salen de `precioParaTipo` (docs/app/06-productos.md): precio
  especial en firme del producto o, si no hay, la lista general del tipo de cliente.

## Decisiones

| Tema | Decisión | Alternativa descartada / pendiente |
|---|---|---|
| Número `COT-AAAA-NNN` | Lo asigna un trigger en la base bajo advisory lock; se ve al guardar | «Máximo + 1» en el navegador (duplica con dos usuarios a la vez) |
| Precio de las líneas | El **servidor** lo recalcula desde el catálogo; el navegador solo manda producto, caja y cantidad | Confiar en el precio que calcula el cliente (as-is) |
| Líneas | `items jsonb` con snapshot (nombre, presentación, precio) | Tabla `cotizacion_items` |
| `total` | Columna derivada, recalculada por la API | Calcularlo siempre desde `items` (más lento para KPI/Dashboard) |
| Tipo de cliente por canal | Columna `canales.tipo_cliente_codigo` + seed | Constante `CANAL_TIPO` en el código |
| Cliente al borrar prospecto | `on delete set null` + `cliente_nombre` | `restrict` o cascada |
| Datos de marca del PDF | `src/config/empresa.ts` | Texto fijo dentro del generador |
| Dependencias nuevas | `jspdf` y `jspdf-autotable` (el as-is ya las usaba por CDN) | PDF en servidor |
| Eliminar | Solo `borrador` (como el as-is) | Eliminar en cualquier estado |

## Novedades respecto al as-is

- Persistencia Postgres + API; el servidor valida estados y permisos (el as-is los
  decidía en el navegador).
- Se rechaza una transición no válida (p. ej. aprobar algo que no está `pendiente`).
- Tipo de caja: sigue obligatorio; **qué significa A/B/C no está definido** y no afecta el
  precio (pendiente de negocio).
- La cotización se abre desde la lista; todavía **no** se abre desde la ficha del prospecto
  ni aparece embebida allí (la ficha avanzada del prospecto sigue «Próximamente»).
- «Descuentos por aprobar» / «Respuestas del supervisor» del as-is viven en Dashboard y
  Supervisión; aquí queda el banner y el filtro «Por aprobar».

## Cómo probar / operar

1. Aplicar la migración `20261023110000_crear_cotizaciones.sql` y los seeds `003`
   (productos) y `004` (canal → tipo de cliente).
2. Login `comercial` → `/cotizaciones` → Nueva cotización: cliente, productos, caja,
   cantidades; Guardar borrador; Generar versión final.
3. Con descuento > 5 %: queda «Pendiente de aprobación». Login `supervisor`: aprobar
   (opcionalmente con menos %) o rechazar; el comercial ve el resultado.
4. Marcar enviada → el prospecto pasa a «Propuesta enviada» (ver `/funnel`). Aceptada →
   «Ganado».
5. Descargar PDF (borrador y final) y revisar `public.bitacora`.

## Archivos clave

- `supabase/migrations/20261023110000_crear_cotizaciones.sql`, `supabase/seed/004_canal_tipo_cliente.sql`
- `src/app/(app)/cotizaciones/page.tsx`, `src/components/CotizacionesPanel.tsx`
- `src/app/api/cotizaciones/` (`route.ts`, `[id]/route.ts`, `[id]/estado`, `[id]/descarga`)
- `src/lib/cotizaciones.ts`, `src/lib/cotizaciones-calculo.ts`, `src/lib/cotizacion-pdf.ts`
- `src/config/cotizaciones.ts`, `src/config/empresa.ts`, `src/lib/types/cotizacion.ts`

## Fuera de alcance (siguientes hitos)

- Crear cotización desde la ficha del prospecto y verlas allí.
- Panel «Descuentos por aprobar» en Dashboard / Supervisión.
- Compromiso automático «Enviar cotización» (depende del módulo Compromisos).

## Próximos posibles desarrollos (no están en el as-is)

- Definir qué significa el tipo de caja y si debe afectar el precio o el despacho.
- Reutilizar el número al borrar (hoy se reutiliza si era el último; podría bloquearse).
- Envío del PDF por correo desde la app.
