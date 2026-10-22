# AGENTS.md — Instrucciones de trabajo para agentes de IA

Este archivo es la **fuente única de verdad** sobre cómo se trabaja en este repositorio.
Aplica a cualquier asistente de IA (Claude Code, Cursor, Copilot, Codex, Windsurf, Gemini,
Aider…) y a cualquier persona del equipo. Los archivos `CLAUDE.md`,
`.github/copilot-instructions.md` y `.cursorrules` solo apuntan aquí: **no dupliques reglas
en ellos**.

Si una instrucción del usuario contradice este documento, gana el usuario — pero **dilo en
voz alta** antes de proceder, sobre todo en las secciones de Base de Datos y Seguridad.

---

## 1. Qué es este proyecto

**Páramo Snacks** es el CRM comercial interno para administrar el negocio de snacks: pipeline
de prospectos, funnel, compromisos (agenda), cotizaciones, catálogo de productos, carga y
seguimiento de ventas, dashboards operativos y supervisión.

**Público:** personas que operan el CRM (comerciales y supervisores). No es una landing
pública ni un sitio de marketing.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase
(base de datos + Auth) · Vercel (deploy). **Sin analítica de producto** (no PostHog ni
equivalentes) salvo decisión explícita futura.

```
src/
├── app/
│   ├── api/                 # API routes — TODO acceso a datos pasa por aquí
│   ├── login/               # Autenticación (Supabase Auth)
│   ├── (app)/               # Shell autenticado de la plataforma
│   │   ├── dashboard/
│   │   ├── supervision/     # auditoría / vista del supervisor (as-is)
│   │   ├── usuarios/        # alta de usuarios (solo supervisor)
│   │   ├── prospectos/
│   │   ├── funnel/
│   │   ├── compromisos/
│   │   ├── cotizaciones/
│   │   ├── productos/
│   │   └── ventas/
│   ├── layout.tsx  page.tsx  globals.css
├── components/
│   ├── ui/                  # Primitivas shadcn/Radix (button, input, select…)
│   ├── forms/               # Formularios de negocio
│   └── *.tsx                # Piezas de dominio, PascalCase
├── config/                  # Configuración de negocio
├── hooks/  lib/  styles/    # Hooks, utilidades y design tokens
supabase/
├── migrations/              # Solo esquema/reglas de BD (sin INSERT de datos)
├── seed/                    # Mock/seed versionado (aplicar a mano)
└── local/                   # SQL ad hoc local (gitignored; no subir)
docs/
├── platform/                # Documentación as-is del sistema actual (especificación)
├── app/                     # Documentación to-be de lo implementado en Next.js
└── supabase/                # Mapa de tablas, flujos y variables
pre-arquitectura/            # Snapshot congelado del sistema actual (HTML + Excel + Python)
```

No hay landing pública ni un panel `/admin` separado: **la plataforma es la aplicación
operativa**. Tras el login, cada usuario opera según su rol (`comercial` o `supervisor`).

**Antes de escribir código, lee lo que ya existe.**

En el setup inicial, `docs/` puede estar vacío. Mientras no haya documentación escrita:

- la especificación as-is es `pre-arquitectura/` (comportamiento, módulos, estética);
- no inventes reglas de negocio que contradigan ese snapshot sin preguntar.

Cuando exista contenido en `docs/`, úsalo en este orden antes de tocar dominio, app o base
de datos:

- `docs/platform/00-indice.md` — mapa, glosario y orden de lectura. **Obligatorio** antes
  de tocar dominio de negocio.
- `docs/platform/02-modelo-de-datos.md` — entidades/columnas y relaciones.
- `docs/platform/04-roles-y-permisos.md` — matriz rol × pantalla × acción (as-is).
- `docs/platform/07-estados.md` — estados de prospecto, cotización, compromiso, etc.
- `docs/platform/05-modulos/` — comportamiento por módulo.
- `docs/platform/08-hallazgos.md` y `09-preguntas-abiertas.md` — riesgos y decisiones
  pendientes antes de diseñar.
- `docs/app/README.md` — índice de lo implementado en Next.js (auth, shell, módulos…).
  **Obligatorio** antes de tocar una pieza ya documentada ahí; **actualizarlo** al entregar.
- `docs/supabase/README.md` — mapa de tablas y variables de entorno. **Obligatorio antes
  de tocar la base de datos** (cuando el documento exista y tenga contenido).
- `.env.example` — cada variable documentada con su porqué; **manténlo actualizado**.

### `pre-arquitectura/` — congelada (solo lectura)

`pre-arquitectura/` es el snapshot del sistema original (HTML/JS + plantilla Excel + script
Python + logo). Es **fuente de contexto y especificación as-is**, no el destino de la nueva
arquitectura.

**Por nada del mundo** se debe modificar, reformatear, “mejorar”, renombrar, mover ni borrar
nada dentro de `pre-arquitectura/`. Ni colaboradores ni agentes de IA. Cualquier cambio de
comportamiento, UI o datos va en la nueva app (`src/`), en migraciones nuevas y en
documentación bajo `docs/` — nunca editando ese snapshot.

Si crees que hace falta tocar un archivo de `pre-arquitectura/`, **para y pregunta**. La
respuesta correcta casi siempre es dejarlo igual y trabajar fuera de esa carpeta.

---

## 2. Cómo trabajamos

### Flujo

1. **Nunca hagas commit directo a** `main`**.** Cuando el usuario autorice una rama, usa
   `feat/…`, `fix/…`, `chore/…` o `docs/…` según el cambio.
2. Cambios pequeños y con un solo propósito. Un PR = una idea defendible.
3. **Operaciones de git solo con autorización explícita del usuario.** Sin pedido o
   autorización clara, **no** crees ramas, **no** hagas commit, **no** hagas `push` ni
   `pull`, **no** hagas merge, **no** abras PRs ni cambies el remoto. Si hace falta una
   de esas operaciones, **pregunta primero** y espera la respuesta. Trabajar en código
   local no implica permiso para tocar el historial ni el remoto.
   **El único repositorio de destino es** `https://github.com/Wandresp2/paramo.git`
   (remoto `origin`). Nunca publiques en otro repo, fork o remoto. Antes de un `push`
   autorizado, comprueba con `git remote -v` que `origin` apunta a esa URL; si no
   coincide, detente y avisa al usuario en lugar de añadir o cambiar remotos.
4. **`npm run build` y `npm run lint`:**
   - **Obligatorios** antes de abrir un pull request o al cerrar un cambio grande
     (módulo nuevo, auth, schema, refactor transversal). Deben pasar; si algo falla, dilo
     con la salida real — nunca reportes éxito sin verificar.
   - **Recomendados** de forma periódica en cambios menores, para detectar regresiones
     temprano. No bloquean cada micro-ajuste local, pero no se omiten por comodidad en
     entregas relevantes.
5. **Documenta todo desarrollo entregable** (ver sección siguiente). Sin documentación
   actualizada, el trabajo **no está terminado**.

### Documentación obligatoria de cada desarrollo

**Regla dura:** todo cambio de producto, arquitectura, API, schema, auth, UI operativa o
datos de prueba debe quedar documentado en `docs/` en el **mismo entregable** (mismo PR /
misma entrega). No se deja “para después”.

Aplica a agentes de IA y a personas del equipo. Un feature sin doc es incompleto aunque el
código compile.

#### Qué hay que dejar por escrito

| Bloque | Contenido mínimo |
|---|---|
| **Desarrollado** | Qué se construyó, rutas/archivos clave, comportamiento visible y endpoints. |
| **Decisiones** | Porqués: alternativas descartadas, trade-offs, reglas de seguridad o de negocio. |
| **Novedades** | Qué cambió respecto al as-is o a la versión anterior (breaking changes, stubs, límites del hito). |
| **Cómo probar / operar** | Variables, seeds, comandos o pasos manuales si aplican. |

#### Dónde documentar

| Tipo de cambio | Destino |
|---|---|
| Pieza de la app Next.js (auth, shell, módulo, API) | `docs/app/` — crea o actualiza el doc del tema y el índice [`docs/app/README.md`](docs/app/README.md) |
| Schema, RLS, seed mock, variables Supabase | [`docs/supabase/README.md`](docs/supabase/README.md) y/o nota en `docs/app/` si afecta la app |
| SQL ad hoc en `supabase/local/` | No se documenta ni se versiona; ver §3.5 |
| Comportamiento as-is (solo si se descubre algo nuevo del sistema viejo) | `docs/platform/` — sin reescribir el snapshot `pre-arquitectura/` |
| Variables de entorno nuevas | `.env.example` **y** mención en el doc correspondiente |
| Cambio que invalida AGENTS.md | Actualiza **este archivo** en la misma entrega |

Idioma: **español**. Tono: operacional y concreto (igual que el resto del repo).

#### Qué no cuenta como documentar

- Un comentario suelto en el PR sin tocar `docs/`.
- Solo actualizar el mensaje de commit.
- Dejar TODOs del tipo “documentar luego”.

### Commits

Conventional Commits con scope, en **español**, en imperativo, describiendo el *qué* y —
cuando no sea obvio — el *por qué*. Mira `git log` antes de escribir el tuyo.

```
feat(db): crear tabla profiles con rol y vínculo a auth.users
fix(security): quitar prefijo NEXT_PUBLIC_ de la service role key
chore: eliminar archivos inalcanzables
```

Scopes en uso: `db`, `auth`, `api`, `dashboard`, `prospectos`, `funnel`, `compromisos`,
`cotizaciones`, `productos`, `ventas`, `usuarios`, `ui`, `security`, `deps`.

### Idioma

- **Todo el proyecto va en español:** UI y copy visible, este archivo, documentación del
  repo, comentarios en el código y mensajes de commit.
- Moneda y fechas de negocio: convención Colombia (`es-CO`).
- Conversación con el equipo: español.

### Comentarios en el código

Este repo comenta el **porqué**, no el qué. Un comentario que repite lo que hace la línea
siguiente es ruido; uno que explica una decisión, un riesgo o una alternativa descartada es
lo que hace mantenible el proyecto.

Sigue ese estándar, en especial en migraciones SQL.

---

## 3. Base de datos (Supabase) — reglas duras

> Estas reglas no son negociables. Si un cambio parece requerir romperlas, **para y pregunta**.

### 3.1 RLS SIEMPRE. Sin excepciones.

Toda tabla nueva en `public` se crea con Row Level Security habilitada **en la misma
migración que la crea**. Nunca "lo activo después".

```sql
alter table public.nueva_tabla enable row level security;
revoke all on public.nueva_tabla from anon, authenticated;
```

**El modelo de acceso de este proyecto es: sin políticas.** La app entera lee y escribe con
`service_role` desde API routes (`src/lib/supabase-server.ts` o el equivalente que exista),
y `service_role` **bypasea RLS**. Por lo tanto, para datos que solo toca el servidor, lo
correcto es:

- RLS habilitada,
- **cero políticas**,
- `revoke all … from anon, authenticated` como cinturón y tirantes, para que una política
  permisiva futura no reabra la tabla por su cuenta.

Solo crea una `policy` si un rol distinto de `service_role` **realmente** necesita acceso
directo desde el navegador. Ese caso hoy **no existe** (todo pasa por API), y añadirlo es
una decisión de arquitectura: justifícala en el comentario de la migración.

**Lección que no se debe repetir:** RLS habilitada con una política permisiva
(`to anon USING (true)` o equivalente) es peor que no tener nada, porque parece segura
mientras la anon key del cliente puede leer o escribir datos sensibles.

**Arquitectura de consumo (decisión del proyecto):** navegador → API routes → Supabase con
`service_role`. Es el patrón correcto para este CRM: reglas de negocio (ownership de
prospectos, aprobación de descuentos, bitácora) viven en el servidor, no duplicadas en
políticas SQL. El rendimiento no depende de eliminar ese hop; depende de lecturas acotadas
(ver §4 Optimización).

### 3.2 No crees tablas de más

La pregunta por defecto ante un dato nuevo es: **¿esto es una columna en una tabla que ya
existe?** Casi siempre lo es.

Antes de crear una tabla, agota en este orden:

1. **Una columna** en la tabla existente (`add column if not exists` + `comment on column`).
2. Un campo dentro de un `jsonb` que ya se guarda.
3. Una vista o un índice, si el problema es de lectura y no de almacenamiento.
4. Y solo entonces, una tabla nueva — **y explica en el encabezado de la migración por qué
   ninguna de las tres opciones anteriores servía.**

Tablas canónicas del dominio (inventario objetivo del rediseño; **no las des por hechas
hasta que existan migraciones aplicadas y respondan en Supabase**):

`profiles` · `prospectos` · `compromisos` · `cotizaciones` · `productos` · `ventas` ·
`ventas_meses` · `observaciones` · `bitacora`.

Mapa, mapeo as-is→tabla y validaciones pendientes: `docs/supabase/README.md`.

`profiles` es la tabla de autorización de la app: un registro por usuario de Supabase Auth
(`auth.users`), con el rol de negocio y los datos de perfil necesarios (nombre, activo,
etc.). La fila y el `rol` no se crean por trigger al registrarse: altas operativas van por
la API `/api/usuarios` (supervisor); el bootstrap del primer supervisor vive en
`supabase/local/` (solo máquina local). La columna `rol` no tiene default y se restringe
en la base a los valores canónicos:

`comercial` · `supervisor`.

El detalle de columnas, IDs y reglas as-is está en `docs/platform/02-modelo-de-datos.md`
(cuando exista) y, mientras tanto, en el snapshot `pre-arquitectura/`. Al migrar, normaliza
nombres a `snake_case` en SQL y documenta el mapeo desde el sistema actual.

Si añades una tabla, añádela aquí **y** comprueba que responde en el entorno antes de darla
por hecha. Una migración commiteada y nunca aplicada no cuenta.

### 3.3 Anatomía de una migración

Nombre: `supabase/migrations/AAAAMMDDHHMMSS_descripcion_en_snake_case.sql`.
Nunca edites una migración ya aplicada: escribe una nueva encima.

**Solo esquema y reglas de base de datos.** Una migración crea o altera tablas, columnas,
índices, constraints, RLS, `revoke`, triggers, funciones, vistas y relaciones. **No**
incluye `INSERT` / `UPDATE` / carga de filas de negocio, catálogo ni datos de prueba
(productos, canales, prospectos, usuarios de demo, etc.). Mock compartido →
`supabase/seed/` (§3.4). SQL ad hoc de desarrollo → `supabase/local/` (§3.5).

Toda migración lleva:

- **Un encabezado que explica la decisión**, no el DDL. Qué problema resuelve, qué
  alternativa se descartó y por qué.
- `begin;` … `commit;` — atómica siempre.
- **Idempotencia**: `if not exists`, y `drop … if exists` antes de recrear constraints y
  políticas. Debe poder correrse dos veces sin explotar.
- `comment on table` / `comment on column` para todo lo nuevo. El esquema se documenta a sí
  mismo.
- **Constraints en la base de datos, no solo en zod.** Formatos, enums
  (`check (rol in (…))`), unicidad y FKs con `on delete` explícito. La validación de la app
  es UX; la de la base de datos es la verdad.
- **Índices para las consultas que realmente se hacen**, con un comentario que diga cuál
  es esa consulta. Índices parciales (`where columna is not null`) cuando aplique.
- **Funciones**: `security definer` + `set search_path = public`, y
  `revoke all on function … from public, anon, authenticated`.
- **Nada de secretos en el esquema.** Los tokens y claves van fuera del SQL versionado
  (variables de entorno / Vault); un secreto escrito en un trigger es legible desde el
  catálogo.

### 3.4 Seed versionado (`supabase/seed/`) — mock compartido, no migraciones

`supabase/seed/` guarda SQL de **datos mock / semilla** que **sí se versionan** en el
repo, para que cualquier persona pueda aplicar filas de prueba tras las migraciones.

Reglas:

- Solo datos de prueba/mock seguros para el equipo. **Nunca** datos personales reales ni
  secretos.
- No es esquema: si hace falta una tabla o columna, va en `migrations/` primero.
- Catálogo o filas que el negocio puede cambiar (productos, canales, etc.) van aquí (o en
  la app), **no** en `migrations/`.
- Ejecución **manual** (SQL Editor, `psql`, etc.). Hoy no hay cableado a `supabase db seed`.
- El bootstrap del primer supervisor **no** va en seed: va en `supabase/local/` (§3.5).

### 3.5 SQL local de desarrollo (`supabase/local/`)

`supabase/local/` es solo para la máquina del desarrollador: scripts `.sql` ad hoc mientras
se desarrolla (escenarios temporales, bootstrap del primer supervisor, experimentos).

Reglas:

- La carpeta **no se sube** a GitHub: está en `supabase/.gitignore` (`local/`).
- Cada quien la crea en local si la necesita (`supabase/local/`).
- Sin orden fijo respecto a migraciones o seed: se generan y ejecutan según necesidad.
- Ejecución manual. No sustituye a `seed/` para datos que el equipo deba compartir.

### 3.6 Datos personales y financieros

Este proyecto almacena nombres de contactos y usuarios, NIT, teléfonos, emails, montos de
cotización y venta, canales y trazas operativas. En consecuencia:

- Nunca hagas `console.log` de un payload de formulario, ni de montos ligados a una
  persona o empresa, ni de un email o contraseña.
- Nunca expongas un endpoint que devuelva datos personales o financieros identificados
  por algo que un tercero pueda adivinar (un email, un id secuencial predecible). Usa
  identificadores opacos y autorización de sesión + rol.
- Nunca añadas un campo que recoja más información de la necesaria "por si acaso".

---

## 4. Seguridad y optimización

### Seguridad — checklist obligatorio

- [ ] `SUPABASE_SERVICE_ROLE_KEY` y cualquier secreto **jamás** llevan prefijo
      `NEXT_PUBLIC_` (Next.js inlinea esas variables en el bundle del navegador).
- [ ] El cliente de Supabase con `service_role` **nunca** se importa desde un componente
      cliente.
- [ ] El navegador **no** habla con Supabase para datos de negocio. Todo pasa por
      `src/app/api/*`.
- [ ] Todo endpoint que reciba datos valida con **zod** y devuelve `422` si falla.
      Nunca confíes en la validación del cliente.
- [ ] Límite de tamaño en el body y rate limiting en login y endpoints sensibles.
- [ ] Endpoints autenticados: verificar la sesión de Supabase Auth en **cada** request y
      **reconsultar** `profiles` (rol, activo, y alcance de datos cuando aplique).
      Nunca confíes solo en un claim de rol embebido en el JWT para autorizar.
- [ ] Autorizar por rol y por acción de negocio (ver matriz as-is en
      `docs/platform/04-roles-y-permisos.md` cuando exista; mientras tanto, el comportamiento
      de `pre-arquitectura/`), no por el nombre de una pantalla.
- [ ] Los fallos de autenticación/autorización devuelven siempre lo mismo (401/403) sin
      revelar cuál de las condiciones falló.
- [ ] Comparaciones de tokens o secretos con `timingSafeEqual`, nunca con `===`.
- [ ] Fallar cerrado: si falta un secreto, se deniega el acceso; no se degrada a "sin auth".
- [ ] Los mensajes de error hacia el usuario no filtran detalles internos ni SQL.
- [ ] Nunca hagas commit de `.env`, `.env.local`, claves, tokens ni credenciales
      hardcodeadas. Toda variable nueva se documenta en `.env.example` con un valor ficticio.
- [ ] Headers de seguridad viven en `next.config` (`X-Frame-Options`,
      `X-Content-Type-Options`, `Referrer-Policy`). No los quites.
- [ ] Dependencias nuevas: justifícalas. Cada una es superficie de ataque y peso en el
      bundle.

### Autenticación y roles

- Supabase Auth crea y gestiona la identidad (login).
- `public.profiles` define el usuario de negocio y su `rol`.
- Roles canónicos: `comercial`, `supervisor`.
- La UI puede ocultar acciones según el rol; **el servidor es quien decide**. Cualquier
  acción de escritura o lectura sensible se vuelve a autorizar en la API.

### Optimización

- **Server Components por defecto.** `'use client'` solo cuando haya estado, efectos o
  eventos — y tan abajo en el árbol como sea posible.
- Imágenes: `next/image` siempre, con `width`/`height` o `fill`.
- Animaciones, si las hay: sobre `transform` y `opacity`; respeta `prefers-reduced-motion`.
  Esta es una herramienta operativa: prioriza claridad y velocidad sobre efectos.
- Componentes pesados y no visibles al cargar: `next/dynamic` cuando aporte.
- Consultas a Supabase (desde el servidor): `select` con columnas explícitas —
  **nunca** `select('*')` en tablas con datos personales o financieros — más `limit`,
  paginación e índices que las respalden.
- **No reimplementes el anti-patrón del sistema actual:** suscripciones o volcados
  completos de colecciones enteras al cliente (Firestore `onSnapshot` / localStorage de
  módulos completos). Diseña lecturas acotadas por pantalla, rol y filtros reales.
- Mide antes de optimizar. No añadas `useMemo`/`useCallback` por reflejo.
- **Borra el código muerto.** Nada de archivos `*-old.tsx`, `*-backup.tsx`, `*-v2.tsx` ni
  scripts de prueba sueltos en la raíz.

---

## 5. Estética: el design system

> **Fuente:** tokens y tipografía tomados del as-is en `pre-arquitectura/` (HTML del CRM).
> No inventes una paleta paralela. Si el equipo cambia marca, actualiza tokens **y** este
> documento en la misma entrega.

**Temas claro y oscuro.** Ambos están permitidos, como en el snapshot (`data-theme`). Es
una herramienta de trabajo diaria: prioriza densidad operativa y legibilidad en ambos modos.
No añadas un tercer “tema de marketing”.

Tokens previstos en `src/styles/paramo-theme.css` (o equivalente), expuestos como
utilidades Tailwind. **Usa siempre el token, nunca el hex ni un color arbitrario de
Tailwind en componentes de producto.**

| Rol | Token | Valor (claro) |
|---|---|---|
| Marca / acento (plum) | `paramo-brand` | `#8A2A66` |
| Marca sobre acento | `paramo-brand-ink` | `#FFFFFF` |
| Marca suave | `paramo-brand-soft` | `#F4E4EE` |
| Acento secundario (teal) | `paramo-teal` | `#54967E` |
| Teal tinta / enlaces | `paramo-teal-ink` | `#3B7A63` |
| Teal suave | `paramo-teal-soft` | `#E2F0EA` |
| Leaf / etiqueta | `paramo-leaf` | `#86BA4E` |
| Olive | `paramo-olive` | `#9E9E3F` |
| Fondo base | `paramo-bg` | `#F3F4F6` |
| Superficie | `paramo-surface` | `#FFFFFF` |
| Superficie elevada | `paramo-surface-2` | `#EEF0F2` |
| Bordes | `paramo-line` | `#E2E5E9` |
| Texto principal | `paramo-fg` | `#1F2328` |
| Texto secundario | `paramo-muted` | `#646B73` |
| Éxito | `paramo-good` | `#3E8B52` |
| Aviso | `paramo-warn` | `#B26A12` |
| Error | `paramo-bad` | `#C0392B` |

Los valores del tema oscuro deben seguir el mapeo del as-is (`:root[data-theme="dark"]` en
el HTML de `pre-arquitectura/`), no una paleta inventada.

```tsx
// correcto
<p className="text-paramo-muted bg-paramo-surface border-paramo-line">
// prohibido
<p className="text-gray-500 bg-[#FFFFFF] border-slate-200">
```

**Reglas visuales**

- **Tipografía:** Arvo (títulos / display) y Mulish (cuerpo / UI). Evita la pila por
  defecto (Inter/Roboto/Arial/system) como identidad del producto.
- **El plum es marca; el teal es acento de acción e interacción** (focus, enlaces, checks).
  No satures fondos grandes con plum.
- **Sin glassmorphism ni glows de marketing.** Bordes sutiles, superficies planas, jerarquía
  por tipografía y espacio (como el CRM original).
- **Densidad operativa:** tablas, filtros y formularios legibles; una tarea clara por
  pantalla o sección.
- **Componentes:** primero reutiliza `src/components/ui/`* (Radix + CVA + `cn()`). Solo crea
  una primitiva nueva si de verdad no existe, y hazlo con el mismo patrón.
- **Mobile-first y responsive real.** Se prueba desde 360px. Objetivos táctiles ≥ 44px.
  El as-is usa rail lateral en desktop y navegación inferior en móvil: respeta esa lógica
  al portar el shell.
- **Accesibilidad:** contraste AA mínimo, focus ring del teal siempre visible (nunca
  `outline: none` sin reemplazo), labels asociados a inputs, `alt` en imágenes con
  contenido, y estados de error anunciados, no solo coloreados de rojo.
- Componentes en **PascalCase**; utilidades y hooks en **camelCase**.

La plataforma autenticada usa el mismo sistema de diseño en todas las rutas operativas.
No introduzcas un shell de marketing distinto.

---

## 6. Tono y público

### A quién le hablamos

Personas que administran y operan el CRM comercial de Páramo Snacks: registran y gestionan
prospectos, mueven el funnel, cumplen compromisos, emiten cotizaciones, mantienen el
catálogo de productos, cargan ventas y —según el rol— supervisan bitácora y aprueban
excepciones (p. ej. descuentos).

### El idioma del producto es **español**

`<html lang="es">`. Copy de pantallas, botones, errores, PDFs y mensajes al usuario en
español. Formatos de moneda y fecha con locale `es-CO` salvo que una pantalla documente
otra necesidad.

### Cómo suena

Claro, concreto y operacional. Frases cortas. Nombres de acciones alineados al negocio:

> “Registrar prospecto”
> “Cargar ventas”
> “Nueva cotización”
> “Aprobar descuento”

**Sí:** verbos en infinitivo o imperativo de oficio, estados explícitos (activo, ganado,
perdido, borrador, pendiente, final), montos y periodos visibles, confirmaciones cuando hay
dinero o borrado de por medio.

**No:** jerga de marketing (“potencia tu gestión”, “unlock”), emojis en el copy del
producto, signos de exclamación múltiples, ni promesas que el sistema no controla.

### Datos y fechas

Valores de configuración de negocio (canales, fuentes, umbrales, catálogo de referencia)
salen de `config/` o de tablas de configuración — **no hardcodees** en un componente una
regla que el negocio pueda cambiar.

---

## 7. Analítica

**No hay analítica de producto en este proyecto por ahora.**

No instales PostHog ni herramientas equivalentes “por si acaso”. Si en el futuro se decide
medir uso:

- hará falta una decisión explícita del equipo,
- un catálogo central de eventos con nombres en `snake_case`,
- y la regla dura de **nunca enviar datos personales o financieros identificables** como
  propiedades de un evento.

Hasta entonces, esta sección existe para impedir que se añada telemetría sin acuerdo.

---

## 8. Lo que NO se hace

- ❌ Crear una tabla sin RLS, o con una política permisiva a `anon` / `authenticated`.
- ❌ Crear una tabla cuando bastaba una columna.
- ❌ Meter `INSERT` / carga de filas de negocio o de prueba en `supabase/migrations/`.
  Mock compartido → `supabase/seed/`; ad hoc local → `supabase/local/`.
- ❌ Versionar `supabase/local/` ni subir SQL de desarrollo personal al remoto.
- ❌ Meter datos personales reales o secretos en `supabase/seed/`.
- ❌ Consultar Supabase desde el navegador para datos de negocio. Todo pasa por
  `src/app/api/*`.
- ❌ Ejecutar migraciones o código directamente en la base de datos de pruebas o de
  producción.
- ❌ Realizar modificaciones en servicios externos sin antes pedir **aprobación explícita**
  del usuario.
- ❌ Poner un secreto detrás de `NEXT_PUBLIC_`.
- ❌ Confiar solo en el cliente (u ocultar botones) para autorizar por rol.
- ❌ Colores, sombras o espaciados hardcodeados en vez de los tokens `paramo-*`.
- ❌ Añadir analítica (PostHog u otra) sin decisión explícita.
- ❌ Montar una landing pública o un `/admin` separado que duplique la plataforma.
- ❌ Loguear datos personales o montos identificables.
- ❌ Dejar archivos de respaldo, scripts sueltos en la raíz o código muerto.
- ❌ Reescribir o "mejorar" código que nadie pidió tocar dentro de un PR de otra cosa.
- ❌ Crear ramas, hacer commit, `push`, `pull`, merge o abrir PRs sin que el usuario lo
  pida o autorice **explícitamente**.
- ❌ Dar por hecha una tabla o migración que no está aplicada en el entorno.
- ❌ Modificar, reformatear o borrar cualquier archivo dentro de `pre-arquitectura/`.
- ❌ Decir que un PR o cambio grande está listo sin haber corrido `npm run build` y
  `npm run lint` (cuando ya exista la app Next.js).
- ❌ Entregar un desarrollo sin documentar en `docs/` lo desarrollado, las decisiones y
  las novedades (ver §2 Documentación obligatoria).

Si una acción de la lista anterior parece necesaria, **para, explica el riesgo y espera
aprobación explícita** del usuario antes de continuar.

---

## 9. Checklist antes de entregar

1. [ ] Si es un **pull request** o un **cambio grande**: `npm run build` pasa y
       `npm run lint` pasa. En cambios menores, se recomienda haberlos corrido al menos de
       forma periódica en la rama.
2. [ ] TypeScript sin `any` nuevos y sin `@ts-ignore`.
3. [ ] Si tocaste la base de datos: migración solo de esquema/reglas (sin carga de filas),
       con encabezado explicativo, transacción, idempotente, RLS habilitada, `revoke`
       aplicado, comentarios en tablas y columnas, constraints e índices justificados.
       Mock compartido → `supabase/seed/`; SQL ad hoc → `supabase/local/` (no versionar).
4. [ ] Si añadiste un endpoint: zod, límite de tamaño, auth/rol según corresponda, y cero
       datos sensibles en logs.
5. [ ] Si tocaste la UI: tokens `paramo-*`, tema claro/oscuro coherente con el as-is,
       probado desde 360px, focus visible, contraste AA, copy en español.
6. [ ] Si añadiste copy: español, tono operacional, fechas/montos con `es-CO` cuando
       aplique.
7. [ ] Si añadiste una variable de entorno: está en `.env.example` con su explicación.
8. [ ] **Documentación obligatoria:** en `docs/` quedó registrado lo **desarrollado**, las
       **decisiones** (y alternativas descartadas cuando aplique) y las **novedades**
       respecto al as-is o a lo previo. Índice `docs/app/README.md` y/o
       `docs/supabase/README.md` actualizados. Si el cambio afecta reglas de trabajo,
       también `AGENTS.md`.
9. [ ] El diff contiene **solo** lo que el cambio necesitaba (código + su documentación).
10. [ ] Reporta con honestidad qué verificaste y qué no.
