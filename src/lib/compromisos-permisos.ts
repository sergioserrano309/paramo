import type { Rol } from "@/config/roles";
import type { CompromisoItem } from "@/lib/types/compromiso";

type Basico = Pick<CompromisoItem, "responsable_id" | "responsable_rol" | "creado_por">;

/**
 * Reglas del as-is sobre quién ve y toca cada compromiso (visC / canToggleC / canEditC).
 * Puras: las usa la API (autoriza) y la UI (muestra u oculta botones).
 *
 * - El supervisor ve todo; el comercial no ve lo que tiene un supervisor como responsable.
 * - Marcar hecho: el supervisor solo lo suyo; el comercial cualquiera que no sea de un
 *   supervisor.
 * - Editar / eliminar: el supervisor lo que creó o le toca; el comercial igual que marcar.
 */
export function puedeVerCompromiso(rol: Rol, c: Basico): boolean {
  return rol === "supervisor" || c.responsable_rol !== "supervisor";
}

export function puedeMarcarCompromiso(rol: Rol, userId: string, c: Basico): boolean {
  return rol === "supervisor"
    ? c.responsable_id === userId
    : c.responsable_rol !== "supervisor";
}

export function puedeEditarCompromiso(rol: Rol, userId: string, c: Basico): boolean {
  return rol === "supervisor"
    ? c.creado_por === userId || c.responsable_id === userId
    : c.responsable_rol !== "supervisor";
}
