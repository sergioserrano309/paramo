/**
 * Pantalla de carga de todos los módulos. Sin este archivo, al hacer clic en el menú no se
 * veía nada hasta que el servidor terminaba de consultar Supabase (la sensación de «se
 * pegó»). Con él, el cambio es inmediato y, en producción, Next precarga esta estructura
 * de cada módulo antes del clic.
 */
export default function Cargando() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-paramo-surface-2" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-paramo-surface-2" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[10px] border border-paramo-line bg-paramo-surface"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[10px] border border-paramo-line bg-paramo-surface" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
