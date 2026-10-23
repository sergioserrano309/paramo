"use client";

import { useState } from "react";
import { ObservacionesLista } from "@/components/ObservacionesLista";
import type { ObservacionItem } from "@/lib/types/observacion";

/** «Observaciones del supervisor» del Dashboard del comercial (as-is obsPanel). */
export function ObservacionesDashboard({
  inicial,
  userId,
  puedeAtender,
}: {
  inicial: ObservacionItem[];
  userId: string;
  puedeAtender: boolean;
}) {
  const [lista, setLista] = useState(inicial);
  if (lista.length === 0) return null;

  return (
    <section className="space-y-3 rounded-[10px] border border-paramo-brand bg-paramo-surface p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
          Observaciones del supervisor
        </h2>
        <span className="text-xs text-paramo-muted">{lista.length} por atender</span>
      </div>
      <ObservacionesLista
        observaciones={lista}
        userId={userId}
        puedeAtender={puedeAtender}
        puedeObservar={false}
        // Al atenderla deja de ser «por atender» y sale del panel, como en el as-is.
        onActualizada={(o) => setLista((prev) => prev.filter((x) => x.id !== o.id))}
        onRetirada={(id) => setLista((prev) => prev.filter((x) => x.id !== id))}
      />
    </section>
  );
}
