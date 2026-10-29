import {
  MODULO_ROLES,
  ROL_ACCIONES,
  type Accion,
  type Modulo,
} from "@/config/permissions";
import type { Rol } from "@/config/roles";

/** Equivalente a `can(a)` del as-is. Seguro para cliente y servidor. */
export function can(rol: Rol, accion: Accion): boolean {
  return ROL_ACCIONES[rol].includes(accion);
}

/** Equivalente a filtrar VIEWS con `only`. */
export function canAccessModule(rol: Rol, modulo: Modulo): boolean {
  return MODULO_ROLES[modulo].includes(rol);
}

/** Equivalente a canCreateP del as-is. */
export function canCreateProspecto(rol: Rol): boolean {
  return can(rol, "editar") || can(rol, "asignar");
}

/**
 * Cada usuario mueve y edita solo los prospectos que tiene asignados, comercial o
 * supervisor. Cambia respecto al as-is (canEditP: `editar` O responsable), donde el
 * comercial podía tocar toda la cartera; los demás prospectos se pueden ver, no tocar.
 * Reasignar es aparte (`canAsignarResponsable`).
 */
export function canEditProspecto(
  rol: Rol,
  userId: string,
  responsableId: string,
): boolean {
  void rol;
  return responsableId === userId;
}

/** Solo quien tiene `asignar` (supervisor) pasa un prospecto a otra persona. */
export function canAsignarResponsable(rol: Rol): boolean {
  return can(rol, "asignar");
}

/** Alta de compromiso: as-is `editar` o `asignar`. */
export function canCreateCompromiso(rol: Rol): boolean {
  return can(rol, "editar") || can(rol, "asignar");
}

/**
 * Lectura de un compromiso.
 * Supervisor ve todos. Comercial solo los que tiene a su cargo
 * (el selector de otro comercial del as-is no se replica).
 */
export function puedeVerCompromiso(
  rol: Rol,
  userId: string,
  responsableId: string | null,
): boolean {
  if (rol === "supervisor") return true;
  return responsableId === userId;
}

export type CompromisoAccess = {
  creadoPor: string | null;
  responsableId: string | null;
  responsableRol: Rol | null;
};

/**
 * El supervisor solo marca lo suyo. El comercial marca como hecho lo que ve (lo suyo),
 * incluido lo que le asignó el supervisor: es como reporta el cumplimiento.
 */
export function canToggleCompromiso(
  rol: Rol,
  userId: string,
  c: CompromisoAccess,
): boolean {
  if (!puedeVerCompromiso(rol, userId, c.responsableId)) return false;
  if (rol === "supervisor") return c.responsableId === userId;
  return c.responsableRol !== "supervisor";
}

/**
 * El supervisor edita lo que creó o lo que tiene a su cargo. El comercial solo lo que él
 * mismo creó: lo que le asigna el supervisor no se edita ni se borra (solo se marca
 * hecho), para no perder el control y seguimiento de la tarea.
 */
export function canEditCompromiso(
  rol: Rol,
  userId: string,
  c: CompromisoAccess,
): boolean {
  if (!puedeVerCompromiso(rol, userId, c.responsableId)) return false;
  if (rol === "supervisor") {
    return c.creadoPor === userId || c.responsableId === userId;
  }
  return c.creadoPor === userId;
}
