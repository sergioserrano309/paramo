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
 * Equivalente a canEditP del as-is: `editar` O soy el responsable.
 * El supervisor no tiene `editar`; solo mueve/edita si es responsable (caso raro).
 *
 * Pendiente validar con negocio: ¿el supervisor debería poder mover etapas
 * de toda la cartera (p. ej. con `asignar`), o se mantiene esta regla as-is?
 */
export function canEditProspecto(
  rol: Rol,
  userId: string,
  responsableId: string,
): boolean {
  return can(rol, "editar") || responsableId === userId;
}

/** As-is canAssign en la ficha: quien edita el prospecto, o el supervisor (`asignar`). */
export function canAsignarResponsable(
  rol: Rol,
  userId: string,
  responsableId: string,
): boolean {
  return canEditProspecto(rol, userId, responsableId) || can(rol, "asignar");
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

/** As-is canToggleC: el supervisor solo marca lo suyo; el comercial, lo que no es de un supervisor. */
export function canToggleCompromiso(
  rol: Rol,
  userId: string,
  c: CompromisoAccess,
): boolean {
  if (!puedeVerCompromiso(rol, userId, c.responsableId)) return false;
  if (rol === "supervisor") return c.responsableId === userId;
  return c.responsableRol !== "supervisor";
}

/** As-is canEditC: el supervisor edita lo que creó o lo que tiene a su cargo. */
export function canEditCompromiso(
  rol: Rol,
  userId: string,
  c: CompromisoAccess,
): boolean {
  if (!puedeVerCompromiso(rol, userId, c.responsableId)) return false;
  if (rol === "supervisor") {
    return c.creadoPor === userId || c.responsableId === userId;
  }
  return c.responsableRol !== "supervisor";
}
