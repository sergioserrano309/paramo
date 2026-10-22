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
