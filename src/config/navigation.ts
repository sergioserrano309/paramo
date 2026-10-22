import { MODULO_ROLES, type Modulo } from "@/config/permissions";
import type { Rol } from "@/config/roles";

export type NavItem = {
  href: string;
  label: string;
  key: Modulo;
};

/** Módulos del shell autenticado (orden del as-is). */
export const APP_NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "supervision", href: "/supervision", label: "Supervisión" },
  { key: "usuarios", href: "/usuarios", label: "Usuarios" },
  { key: "prospectos", href: "/prospectos", label: "Prospectos" },
  { key: "funnel", href: "/funnel", label: "Funnel" },
  { key: "compromisos", href: "/compromisos", label: "Compromisos" },
  { key: "cotizaciones", href: "/cotizaciones", label: "Cotizaciones" },
  { key: "productos", href: "/productos", label: "Productos" },
  { key: "ventas", href: "/ventas", label: "Ventas" },
];

/** Navegación visible según rol (as-is: filter por `only`). */
export function navForRol(rol: Rol): NavItem[] {
  return APP_NAV.filter((item) => MODULO_ROLES[item.key].includes(rol));
}
