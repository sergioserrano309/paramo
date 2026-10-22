export type NavItem = {
  href: string;
  label: string;
  /** Clave corta para data attributes / tests */
  key: string;
};

/** Módulos del shell autenticado (orden del as-is). */
export const APP_NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "supervision", href: "/supervision", label: "Supervisión" },
  { key: "prospectos", href: "/prospectos", label: "Prospectos" },
  { key: "funnel", href: "/funnel", label: "Funnel" },
  { key: "compromisos", href: "/compromisos", label: "Compromisos" },
  { key: "cotizaciones", href: "/cotizaciones", label: "Cotizaciones" },
  { key: "productos", href: "/productos", label: "Productos" },
  { key: "ventas", href: "/ventas", label: "Ventas" },
];
