import type { EstadoProducto, LineaProducto } from "@/config/productos";

/** `pct` = % de descuento sobre el PVP; `precio` = precio fijo en COP. */
export type ModoPrecio = "pct" | "precio";

export type PrecioProducto = { modo: ModoPrecio; v: number };

/** Precios en firme por `tipos_cliente.codigo`. */
export type PreciosProducto = Record<string, PrecioProducto>;

/** Propuesta del comercial. `modo: null` = propone quitar el precio especial. */
export type PrecioPendiente = {
  modo: ModoPrecio | null;
  v: number;
  por: string;
  por_nombre: string;
  en: string;
};

export type PreciosPendientes = Record<string, PrecioPendiente>;

export type ProductoListItem = {
  id: string;
  nombre: string;
  sku: string;
  linea: LineaProducto;
  presentacion: string;
  estado: EstadoProducto;
  precio_publico: number;
  lanzamiento: string | null;
  descripcion: string;
  precios: PreciosProducto;
  precios_pendientes: PreciosPendientes;
  creado_en: string;
  actualizado_en: string;
};

/** Tipo de cliente con su % de la lista general (as-is pctFor). */
export type TipoClientePrecio = {
  codigo: string;
  nombre: string;
  descuento_pct: number;
};
