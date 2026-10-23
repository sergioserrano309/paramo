"use client";

import { useEffect, useState } from "react";

const CLAVE = "paramo-crm-tema";

/**
 * Alterna tema claro / oscuro (as-is setTheme). La preferencia queda solo en este navegador
 * (conveniencia por usuario, no un dato de negocio); si no hay almacenamiento, funciona
 * igual durante la sesión.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado === "dark" || guardado === "light") {
        document.documentElement.setAttribute("data-theme", guardado);
        setOscuro(guardado === "dark");
        return;
      }
    } catch {
      // Sin acceso al almacenamiento: se usa el tema por defecto.
    }
    setOscuro(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function alternar() {
    const siguiente = oscuro ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", siguiente);
    setOscuro(!oscuro);
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // Intencional: ver comentario del componente.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
      className={
        className ??
        "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-paramo-line px-3 text-sm font-bold text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
      }
    >
      {oscuro ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}
