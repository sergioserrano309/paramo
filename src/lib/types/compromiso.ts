import type { Rol } from "@/config/roles";

/** Próximo compromiso pendiente por prospecto (nextComp del as-is). */
export type ProximoCompromiso = {
  id: string;
  prospecto_id: string;
  titulo: string;
  tipo: string;
  fecha: string;
};

/** Fila de la agenda /compromisos. */
export type CompromisoAgendaItem = {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  prospecto_id: string | null;
  prospecto_empresa: string | null;
  hecho: boolean;
  hecho_en: string | null;
  notas: string;
  asignado: boolean;
  responsable_id: string | null;
  responsable_nombre: string;
  responsable_rol: Rol | null;
  creado_por: string | null;
};

/** Al marcar cumplido, la API devuelve el día escrito en el prospecto. */
export type ProspectoContactoActualizado = {
  id: string;
  ultimo_contacto: string;
};
