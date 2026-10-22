import type { Rol } from "@/config/roles";

export type Profile = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
};
