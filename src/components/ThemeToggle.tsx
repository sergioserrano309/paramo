"use client";

import { useEffect, useState } from "react";

const TEMA_KEY = "paramo-crm-tema";

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/**
 * Interruptor del tema (data-theme + la misma clave local del as-is).
 * `className` lo usa la barra inferior del móvil; en el rail se ve el botón completo.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(TEMA_KEY);
      if (guardado === "dark" || guardado === "light") {
        document.documentElement.setAttribute("data-theme", guardado);
        setDark(guardado === "dark");
        return;
      }
    } catch {
      /* sin almacenamiento: se usa el tema ya puesto en el documento */
    }
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(TEMA_KEY, next);
    } catch {
      /* el tema igual cambia en esta pestaña */
    }
    setDark(next === "dark");
  }

  const etiqueta = dark ? "Modo claro" : "Modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Activar ${etiqueta.toLowerCase()}`}
      className={
        className ??
        "inline-flex min-h-11 w-full items-center gap-2 rounded-full border border-paramo-line bg-paramo-surface px-3 text-[12.5px] font-bold text-paramo-fg hover:border-paramo-muted"
      }
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      {className ? null : etiqueta}
    </button>
  );
}
