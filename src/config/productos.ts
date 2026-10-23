/** Líneas de producto (as-is LINEAS). Mismos códigos que el CHECK de `productos.linea`. */
export const LINEAS_PRODUCTO = [
  { codigo: "frutas", nombre: "Frutas" },
  { codigo: "vegetales", nombre: "Vegetales" },
  { codigo: "packs", nombre: "Packs" },
  { codigo: "otra", nombre: "Otra" },
] as const;

export type LineaProducto = (typeof LINEAS_PRODUCTO)[number]["codigo"];

/**
 * Estados del producto (as-is ESTADOS). `orden` replica el orden del listado del as-is:
 * lanzamiento, desarrollo, activo, descontinuado.
 */
export const ESTADOS_PRODUCTO = [
  { codigo: "desarrollo", nombre: "En desarrollo", orden: 1, tono: "olive" },
  { codigo: "lanzamiento", nombre: "Lanzamiento", orden: 0, tono: "brand" },
  { codigo: "activo", nombre: "Activo", orden: 2, tono: "teal" },
  { codigo: "descontinuado", nombre: "Descontinuado", orden: 3, tono: "muted" },
] as const;

export type EstadoProducto = (typeof ESTADOS_PRODUCTO)[number]["codigo"];

export function isLineaProducto(v: string): v is LineaProducto {
  return LINEAS_PRODUCTO.some((l) => l.codigo === v);
}

export function isEstadoProducto(v: string): v is EstadoProducto {
  return ESTADOS_PRODUCTO.some((e) => e.codigo === v);
}

export function nombreLinea(codigo: string): string {
  return LINEAS_PRODUCTO.find((l) => l.codigo === codigo)?.nombre ?? codigo;
}

export function estadoProducto(codigo: string) {
  return ESTADOS_PRODUCTO.find((e) => e.codigo === codigo) ?? ESTADOS_PRODUCTO[0];
}

/** Tipos de retroalimentación de un producto (as-is FB_TIPOS). */
export const FB_TIPOS = [
  "Degustación",
  "Comentario de cliente",
  "Pedido piloto",
  "Prueba interna",
] as const;

/** Tipo de cliente sin descuento: paga el PVP (as-is 'final'). */
export const TIPO_CLIENTE_PVP = "final";

/** Rangos del as-is al definir precio por producto (%) y lista general (%). */
export const PCT_MAX_PRODUCTO = 90;
export const PCT_MAX_LISTA_GENERAL = 80;
