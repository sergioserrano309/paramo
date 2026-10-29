/** Descuento máximo sin aprobación del supervisor, en % (as-is DESC_MAX). */
export const DESC_MAX = 5;

/** Tope del campo descuento (el input del as-is limita a 60). */
export const DESC_TOPE = 60;

export const PAGOS = [
  "Contado",
  "Crédito 15 días",
  "Crédito 30 días",
  "Crédito 60 días",
] as const;

export type Pago = (typeof PAGOS)[number];

export const PAGO_DEFAULT: Pago = "Crédito 30 días";
export const VALIDEZ_DEFAULT_DIAS = 15;
export const IVA_DEFAULT = 19;

/** Tipos de caja (as-is CAJAS). Obligatorios al generar la versión final. */
export const CAJAS = ["Tipo A", "Tipo B", "Tipo C"] as const;

export const ESTADOS_COTIZACION = [
  { codigo: "borrador", nombre: "Borrador", tono: "muted" },
  { codigo: "pendiente", nombre: "Pendiente de aprobación", tono: "warn" },
  { codigo: "rechazada", nombre: "Descuento rechazado", tono: "bad" },
  { codigo: "final", nombre: "Lista para enviar", tono: "teal" },
  { codigo: "enviada", nombre: "Enviada al cliente", tono: "brand" },
  { codigo: "aceptada", nombre: "Aceptada", tono: "leaf" },
  { codigo: "no_aceptada", nombre: "No aceptada", tono: "rasp" },
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number]["codigo"];

export function estadoCotizacion(codigo: string) {
  return ESTADOS_COTIZACION.find((e) => e.codigo === codigo) ?? ESTADOS_COTIZACION[0];
}

export function isEstadoCotizacion(v: string): v is EstadoCotizacion {
  return ESTADOS_COTIZACION.some((e) => e.codigo === v);
}

/** Estados en que la cotización ya se generó en versión final (as-is isFinalQ). */
export const ESTADOS_FINALES: readonly EstadoCotizacion[] = [
  "final",
  "enviada",
  "aceptada",
  "no_aceptada",
];

/**
 * Con el descuento aprobado, la cotización queda cerrada: no se edita nada. Para cambiarla
 * se crea una nueva versión (vuelve a borrador).
 */
export function estaBloqueada(c: { estado: string; aprobacion: unknown | null }): boolean {
  return c.estado === "final" && c.aprobacion !== null;
}

/** Estados en que se pueden editar los campos (as-is qEditable). */
export const ESTADOS_EDITABLES: readonly EstadoCotizacion[] = [
  "borrador",
  "rechazada",
  "pendiente",
  "final",
];
