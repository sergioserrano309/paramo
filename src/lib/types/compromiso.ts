import type { Rol } from "@/config/roles";
import type { TipoCompromiso } from "@/config/compromisos";

export type CompromisoItem = {
  id: string;
  titulo: string;
  tipo: TipoCompromiso;
  fecha: string;
  prospecto_id: string | null;
  prospecto_empresa: string | null;
  notas: string;
  hecho: boolean;
  hecho_en: string | null;
  responsable_id: string;
  responsable_nombre: string;
  responsable_rol: Rol;
  asignado: boolean;
  creado_por: string | null;
};

export type PersonaOption = {
  id: string;
  nombre: string;
  rol: Rol;
};
