export type ObservacionItem = {
  id: string;
  prospecto_id: string | null;
  prospecto_empresa: string | null;
  texto: string;
  estado: "abierta" | "atendida";
  autor_id: string | null;
  autor_nombre: string;
  respuesta: string;
  atendida_en: string | null;
  creado_en: string;
};
