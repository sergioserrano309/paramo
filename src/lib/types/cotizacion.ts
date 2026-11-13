import type { EstadoCotizacion, Pago } from "@/config/cotizaciones";
import type { Moneda } from "@/lib/precios";

export type CotizacionItem = {
  producto_id: string | null;
  nombre: string;
  presentacion: string;
  caja: string;
  cant: number;
  /** Precio unitario cotizado, en la moneda de la cotización. */
  precio: number;
  /**
   * Precio del catálogo al cotizar (snapshot). Si difiere de `precio`, el comercial lo
   * cambió a mano. null = cotización anterior a este campo: no se considera cambiada.
   */
  precio_lista: number | null;
};

/** Precio de una línea que el supervisor aprobó (producto + precio cotizado). */
export type PrecioAprobado = { producto_id: string; precio: number };

export type DecisionDescuento = {
  por: string;
  por_nombre: string;
  en: string;
  solicitado: number;
  comentario: string;
};

export type AprobacionDescuento = DecisionDescuento & {
  desc: number;
  /** Cambios de precio aprobados en la misma decisión (vacío si solo era descuento). */
  precios: PrecioAprobado[];
};

export type CotizacionListItem = {
  id: string;
  numero: string;
  version: number;
  prospecto_id: string | null;
  cliente_nombre: string;
  tipo_cliente_codigo: string | null;
  fecha: string;
  moneda: Moneda;
  validez_dias: number;
  pago: Pago;
  entrega: string;
  notas: string;
  items: CotizacionItem[];
  desc_pct: number;
  iva_pct: number;
  total: number;
  estado: EstadoCotizacion;
  desc_solicitado: number | null;
  solicitado_en: string | null;
  aprobacion: AprobacionDescuento | null;
  rechazo: DecisionDescuento | null;
  final_en: string | null;
  enviada_en: string | null;
  cerrada_en: string | null;
  creado_por: string | null;
  creado_por_nombre: string;
  creado_en: string;
};

/** Datos del cliente que imprime el PDF; no viajan con el listado. */
export type ContactoCliente = {
  nit: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  ciudad: string;
};

/** Prospecto tal como lo necesita el formulario de cotización. */
export type ProspectoCotizable = {
  id: string;
  empresa: string;
  ciudad: string;
  /** Tipo de cliente efectivo: el del prospecto o, si no tiene, el de su canal. */
  tipo_cliente_codigo: string;
  responsable_id: string;
  etapa_codigo: string;
  activo: boolean;
};

export type TotalesCotizacion = {
  sub: number;
  d: number;
  dv: number;
  base: number;
  iva: number;
  tot: number;
};
