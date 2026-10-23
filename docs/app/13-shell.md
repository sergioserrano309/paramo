# Shell: menú, tema, atajos y contadores (Hito 12)

## Desarrollado

- **Menú lateral** en escritorio y **barra inferior en móvil** (as-is: rail + navegación
  inferior), con etiquetas cortas «Agenda» y «Cotizar».
- **Contadores del menú** (as-is `navHTML`): Compromisos (vencidos), Cotizaciones
  (descuentos por aprobar para el supervisor; rechazadas para el comercial), Productos
  (precios por aprobar, supervisor), Dashboard (observaciones por atender, comercial) y
  Supervisión (observaciones abiertas). Se calculan en el servidor en cada carga con
  consultas de conteo (`src/lib/insignias.ts`).
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
