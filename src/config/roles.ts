/** Roles canónicos de negocio (columna profiles.rol). */
export const ROLES = ["comercial", "supervisor"] as const;

export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  comercial: "Comercial",
  supervisor: "Supervisor",
};

export function isRol(value: string): value is Rol {
  return (ROLES as readonly string[]).includes(value);
}
