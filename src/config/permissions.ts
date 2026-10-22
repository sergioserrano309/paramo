import type { Rol } from "@/config/roles";

/**
 * Capacidades canónicas del as-is (ROLES[…].can en pre-arquitectura).
 * Ownership fino (responsable de prospecto, etc.) se aplica encima en cada módulo.
 */
export const ACCIONES = [
  "editar",
  "observar",
  "asignar",
  "auditar",
  "usuarios",
] as const;

export type Accion = (typeof ACCIONES)[number];

export const ROL_ACCIONES: Record<Rol, readonly Accion[]> = {
  comercial: ["editar"],
  supervisor: ["observar", "asignar", "auditar", "usuarios"],
};

/** Claves de módulo alineadas a rutas / navegación. */
export const MODULOS = [
  "dashboard",
  "supervision",
  "usuarios",
  "prospectos",
  "funnel",
  "compromisos",
  "cotizaciones",
  "productos",
  "ventas",
] as const;

export type Modulo = (typeof MODULOS)[number];

/**
 * Acceso a pantalla. Supervisión y Usuarios solo `supervisor`.
 * El resto es visible para ambos roles (las acciones dentro varían).
 */
export const MODULO_ROLES: Record<Modulo, readonly Rol[]> = {
  dashboard: ["comercial", "supervisor"],
  supervision: ["supervisor"],
  usuarios: ["supervisor"],
  prospectos: ["comercial", "supervisor"],
  funnel: ["comercial", "supervisor"],
  compromisos: ["comercial", "supervisor"],
  cotizaciones: ["comercial", "supervisor"],
  productos: ["comercial", "supervisor"],
  ventas: ["comercial", "supervisor"],
};
