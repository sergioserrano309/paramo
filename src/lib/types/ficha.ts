import type { EstadoCotizacion } from "@/config/cotizaciones";
import type { CompromisoItem } from "@/lib/types/compromiso";
import type { ObservacionItem } from "@/lib/types/observacion";
import type { ProspectoListItem } from "@/lib/types/prospecto";

export type ActividadItem = {
  id: string;
  fecha: string;
  tipo: string;
  texto: string;
  usuario_nombre: string;
};

export type CotizacionResumen = {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  fecha: string;
  desc_pct: number;
  total: number;
};

export type ProductoInteres = {
  id: string;
  nombre: string;
  estado: string;
  interesado: boolean;
};

export type FichaProspecto = {
  prospecto: ProspectoListItem;
  inactivo_en: string | null;
  motivo_inactivo: string;
  creado_por_nombre: string;
  actividad: ActividadItem[];
  compromisos: CompromisoItem[];
  observaciones: ObservacionItem[];
  cotizaciones: CotizacionResumen[];
  productos: ProductoInteres[];
};
