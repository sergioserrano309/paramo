export type VentaMes = {
  mes: string;
  filas: number;
  unidades: number;
  valor: number;
  archivo: string;
  cargado_en: string | null;
  cargado_por_nombre: string;
};

export type VentaResumenFila = {
  clave: string;
  etiqueta: string;
  canal: string;
  unidades: number;
  valor: number;
  ultima: string | null;
  clientes: number;
};

export type VentaTotales = {
  valor: number;
  unidades: number;
  clientes: number;
  filas: number;
};

export type AgruparVentasPor = "cliente" | "producto" | "canal" | "mes";
