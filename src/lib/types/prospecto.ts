import type { Rol } from "@/config/roles";
import type { ActividadItem } from "@/lib/actividad";

export type CatalogoItem = {
  codigo: string;
  nombre: string;
  orden: number;
};

export type EtapaCatalogo = CatalogoItem & {
  probabilidad: number;
  en_pipeline: boolean;
};

export type TipoClienteCatalogo = CatalogoItem & {
  descuento_pct_default: number;
};

export type ResponsableOption = {
  id: string;
  nombre: string;
  rol: Rol;
};

export type ProspectoListItem = {
  id: string;
  empresa: string;
  nit: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  ciudad: string;
  canal_codigo: string | null;
  canal_nombre: string | null;
  tipo_cliente_codigo: string | null;
  tipo_cliente_nombre: string | null;
  fuente_codigo: string | null;
  fuente_nombre: string | null;
  etapa_codigo: string;
  etapa_nombre: string;
  valor_mensual_estimado: number;
  calificacion: number;
  notas: string;
  activo: boolean;
  motivo_perdida: string;
  motivo_inactivo: string;
  inactivo_en: string | null;
  etapa_desde: string;
  ganado_en: string | null;
  actividad: ActividadItem[];
  responsable_id: string;
  responsable_nombre: string;
  creado_por_nombre: string | null;
  creado_en: string;
  ultimo_contacto: string | null;
  /** Compromiso pendiente más cercano; se completa en los listados (as-is nextComp). */
  proximo_compromiso: { fecha: string; titulo: string } | null;
  /** Observaciones del supervisor sin atender sobre este prospecto. */
  observaciones_abiertas: number;
};

export type ProspectosCatalogos = {
  canales: CatalogoItem[];
  fuentes: CatalogoItem[];
  tipos_cliente: TipoClienteCatalogo[];
  etapas: EtapaCatalogo[];
  responsables: ResponsableOption[];
};
