"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Atajos del as-is: «N» abre un prospecto nuevo y «C» un compromiso nuevo. No actúan al
 * escribir en un campo ni con teclas modificadoras. El token cambia en cada pulsación para
 * que el panel de destino vuelva a abrirse aunque ya esté en esa pantalla.
 */
export function AtajosTeclado({
  puedeCrearProspecto,
  puedeCrearCompromiso,
}: {
  puedeCrearProspecto: boolean;
  puedeCrearCompromiso: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (k === "n" && puedeCrearProspecto) {
        e.preventDefault();
        router.push(`/prospectos?nuevo=${Date.now()}`);
      } else if (k === "c" && puedeCrearCompromiso) {
        e.preventDefault();
        router.push(`/compromisos?nuevo=${Date.now()}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, puedeCrearProspecto, puedeCrearCompromiso]);

  return null;
}
