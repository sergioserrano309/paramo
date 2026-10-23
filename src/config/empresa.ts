/**
 * Datos de la marca que salen en el PDF de la cotización (as-is quotePDF). Viven aquí y no
 * dentro del generador porque son datos de negocio que pueden cambiar.
 */
export const EMPRESA = {
  nombrePdf: "Good Chips by Páramo Snacks",
  contacto: "Bogotá, Colombia  ·  info@paramosnacks.com  ·  +57 321 757 0181  ·  www.paramosnacks.com",
  lema: "Invertimos el 2% de nuestras ventas en la protección de los páramos y los bosques de niebla.",
  /** Copia del logo del as-is para el PDF, servida desde /public. */
  logo: "/logo-paramo.jpg",
} as const;
