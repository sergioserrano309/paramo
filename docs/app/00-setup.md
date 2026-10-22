# Setup inicial — Páramo Snacks CRM

## Desarrollado

- App Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4.
- Estructura de carpetas alineada a `AGENTS.md` (`src/app`, `components`, `config`, `lib`, `styles`, `supabase`, `docs`).
- Shell autenticado con navegación a los 8 módulos (stubs).
- Tokens de marca `paramo-*` (claro/oscuro) desde el as-is.
- Cliente Supabase `service_role` en `src/lib/supabase-server.ts` (solo servidor).
- `.gitignore` que excluye secretos; `.env.example` documentado.
- Endpoint `GET /api/health` para verificar que la API responde.

## Decisiones

- **API + service_role + RLS sin políticas:** el navegador no consulta datos de negocio en Supabase; todo pasa por `src/app/api/*` (ver `AGENTS.md` §3).
- **Módulos como stubs:** el setup deja rutas y shell listos; la lógica se porta después desde `pre-arquitectura/` sin editar ese snapshot.
- **`.env.example` versionado; `.env` / `.env.local` ignorados.**
- Auth real (login + middleware + `profiles`): ver [01-auth.md](./01-auth.md).

## Novedades respecto al as-is

- Del monólito HTML + Excel + Python se pasa a Next.js + Supabase + migraciones SQL.
- `pre-arquitectura/` queda congelada como especificación.

## Cómo probar / operar

### Requisitos

- Node.js 20+ (probado con 24)
- npm 10+

### Pasos

```bash
git clone https://github.com/Wandresp2/paramo.git
cd paramo
npm install
cp .env.example .env.local
# Edita .env.local con las claves de tu proyecto Supabase
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) → redirige a `/login`.

```bash
npm run build
npm run lint
```

### Variables

Ver `.env.example`. Obligatorias para datos reales:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; sin `NEXT_PUBLIC_`)
