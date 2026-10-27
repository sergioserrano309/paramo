# Shell: menú, tema, atajos y contadores (Hito 12)

## Desarrollado

- **Menú lateral** en escritorio y **barra inferior en móvil** (as-is: rail + navegación
  inferior), con etiquetas cortas «Agenda» y «Cotizar».
- **Contadores del menú** (as-is `navHTML`): Compromisos (vencidos), Cotizaciones
  (descuentos por aprobar para el supervisor; rechazadas para el comercial), Productos
  (precios por aprobar, supervisor), Dashboard (observaciones por atender, comercial) y
  Supervisión (observaciones abiertas). Se calculan en el servidor con consultas de conteo
  (`src/lib/insignias.ts`) y **se guardan 30 segundos por rol** (`unstable_cache`): pedirlos en
  cada navegación frenaba el cambio entre módulos. Un contador puede ir hasta 30 s atrasado.
- **Tema claro / oscuro** (`ThemeToggle`): botón en el menú y en la barra móvil; la
  preferencia queda en `localStorage` de este navegador.
- **Atajos de teclado:** **N** abre un prospecto nuevo y **C** un compromiso nuevo (no actúan
  al escribir en un campo ni con Ctrl / Alt / Meta). Requieren poder crear
  (`editar` o `asignar`).

## Decisiones

| Tema | Decisión | Alternativa descartada |
|---|---|---|
| Contadores | Consultas de conteo en el layout | Suscripción en vivo (as-is con Firestore) |
| Tema | Atributo `data-theme` + `localStorage` | Cookie (el servidor no necesita saberlo) |
| Atajos | `router.push` con token distinto en cada pulsación | Estado global compartido |

## Rendimiento de la navegación

Medido el 2026-10-27: ida y vuelta de la red del usuario a Vercel ≈ 0,25 s; la función corre en
`iad1` (Washington). Cambiar de módulo hacía 7–9 viajes seguidos a Supabase y no mostraba nada
hasta terminarlos. Qué se hizo:

| Cambio | Efecto |
|---|---|
| `src/app/(app)/loading.tsx` | Esqueleto inmediato al hacer clic; en producción Next precarga la estructura del módulo |
| `experimental.staleTimes.dynamic = 20` (`next.config.ts`) | Volver a un módulo en 20 s no repite el viaje; `router.refresh()` limpia el caché |
| `getClaims()` en `middleware.ts` y `getAuthContext` | Quita 2 viajes a Supabase Auth por petición; el perfil sigue reconsultándose en cada una |
| `cache()` en `getAuthContext` | Layout y página comparten la sesión del mismo render |
| Contadores del menú con `unstable_cache` (30 s) | 4 consultas menos por clic |
| Dashboard y Supervisión en una sola ronda; aprobaciones solo traen las cotizaciones pendientes | Menos viajes y menos datos |

**Trade-off de seguridad:** con `getClaims` una sesión cerrada en otro dispositivo sigue válida
hasta que venza su token (≤ 1 h). Desactivar al usuario o cambiarle el rol surte efecto de
inmediato porque `profiles` se consulta en cada petición.

**Pendiente de medir:** región de Supabase frente a la de Vercel (`iad1`); si están lejos, cada
viaje cuesta más.

## Novedades respecto al as-is

- Sin banner «Perfil Supervisor» ni indicador «Conectado · guardado automático»: no aplican
  a la arquitectura nueva.
- El tema se aplica al cargar la página (puede verse un instante el tema claro).

## Cómo probar / operar

1. Entrar como comercial y supervisor: ver los contadores cuando haya datos.
2. Pulsar **N** y **C** en cualquier pantalla (fuera de un campo de texto).
3. Cambiar el tema y recargar: debe recordarse.
4. Reducir la ventana a ~360 px: aparece la barra inferior y el contenido no queda tapado.

## Archivos clave

- `src/components/AppShell.tsx`, `src/components/AppNav.tsx`, `src/components/ThemeToggle.tsx`,
  `src/components/AtajosTeclado.tsx`
- `src/lib/insignias.ts`, `src/app/(app)/layout.tsx`, `src/config/navigation.ts`
