# Páramo Snacks — CRM comercial

Plataforma interna para gestionar prospectos, funnel, compromisos, cotizaciones, productos y ventas.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS · Supabase · Vercel.

Reglas de trabajo para el equipo y agentes de IA: [`AGENTS.md`](./AGENTS.md).

## Arranque rápido

```bash
npm install
cp .env.example .env.local
# Completa las variables de Supabase en .env.local
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

```bash
npm run build
npm run lint
```

## Estructura

```
src/app/          # App Router (login, módulos, API)
src/components/   # UI y piezas de dominio
src/config/       # Navegación, roles
src/lib/          # Supabase servidor, env, utilidades
src/styles/       # Tokens paramo-*
supabase/         # Migraciones y seeds
docs/             # Documentación (app, platform, supabase)
pre-arquitectura/ # Snapshot as-is — NO modificar
```

Más detalle del setup: [`docs/app/00-setup.md`](./docs/app/00-setup.md).
