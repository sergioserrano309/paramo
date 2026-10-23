import { norm } from "@/lib/texto";

/** Fila ya validada del Excel (as-is: [fecha, cliente, canal, ciudad, producto, unid., valor]). */
export type FilaVenta = {
  fecha: string;
  cliente: string;
  canal: string;
  ciudad: string;
  producto: string;
  unidades: number;
  valor: number;
};

export type VistaPreviaCarga = {
  archivo: string;
  hoja: string;
  filas: FilaVenta[];
  errores: string[];
  faltantes: string[];
  omitidas: number;
};

/** Máximo recomendado por la plantilla («10.000 filas por archivo»). */
export const MAX_FILAS_CARGA = 10_000;

const pad = (n: number | string) => String(n).padStart(2, "0");

/**
 * Número tolerante a formato colombiano y anglosajón (as-is parseNum): «1.234.567»,
 * «1,234,567», «1.234,56», «$ 1 234 COP».
 */
export function parseNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[$\s]/g, "").replace(/COP/i, "");
  if (!s) return null;
  const tienePunto = s.includes(".");
  const tieneComa = s.includes(",");
  if (tienePunto && tieneComa) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (tienePunto) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  } else if (tieneComa) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

/** Fecha a AAAA-MM-DD (as-is parseDate); texto dd/mm/aaaa o aaaa-mm-dd, o serial de Excel. */
export function parseFecha(
  v: unknown,
  serialADate: (n: number) => { y: number; m: number; d: number } | null,
): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // cellDates entrega medianoche UTC-5; +12 h evita caer al día anterior.
    const d = new Date(v.getTime() + 12 * 3_600_000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const o = serialADate(v);
    return o ? `${o.y}-${pad(o.m)}-${pad(o.d)}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}

function fechaReal(f: string): boolean {
  const d = new Date(`${f}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

/**
 * Lee un .xlsx / .xls / .csv con la plantilla de ventas y lo valida fila a fila
 * (as-is handleFile). SheetJS se importa bajo demanda: solo pesa para quien carga ventas.
 */
export async function leerArchivoVentas(file: File): Promise<VistaPreviaCarga> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });

  const nombre =
    wb.SheetNames.find((n) => norm(n) === "ventas") ??
    wb.SheetNames.find((n) => norm(n).includes("venta")) ??
    wb.SheetNames.find((n) => norm(n) !== "instrucciones" && !norm(n).includes("catalogo")) ??
    wb.SheetNames[0];

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], {
    header: 1,
    raw: true,
    defval: null,
  });

  let hr = aoa.findIndex(
    (r, i) =>
      i < 15 &&
      Array.isArray(r) &&
      r.some((c) => norm(c) === "cliente") &&
      r.some((c) => norm(c).includes("producto") || norm(c).includes("referencia")),
  );
  if (hr < 0) hr = 0;

  const H = ((aoa[hr] ?? []) as unknown[]).map(norm);
  const idx = (f: (h: string) => boolean) => H.findIndex(f);
  const col = {
    fecha: idx((h) => h.includes("fecha")),
    cliente: idx((h) => h === "cliente" || h.startsWith("cliente") || h.includes("razon social")),
    canal: idx((h) => h.includes("canal")),
    ciudad: idx((h) => h.includes("ciudad")),
    producto: idx((h) => h.includes("producto") || h.includes("referencia")),
    unidades: idx((h) => h.includes("unidad") || h.includes("cantidad")),
    precio: idx((h) => h.includes("precio")),
    valor: idx((h) => h.includes("valor") || h.includes("total") || h === "venta"),
  };

  const faltantes: string[] = [];
  if (col.fecha < 0) faltantes.push("Fecha");
  if (col.cliente < 0) faltantes.push("Cliente");
  if (col.producto < 0) faltantes.push("Producto");
  if (col.unidades < 0) faltantes.push("Unidades");
  if (col.valor < 0 && col.precio < 0) faltantes.push("Valor venta o Precio unitario");

  const filas: FilaVenta[] = [];
  const errores: string[] = [];
  let omitidas = 0;

  if (faltantes.length === 0) {
    for (let i = hr + 1; i < aoa.length; i++) {
      const r = aoa[i] as unknown[] | undefined;
      if (!r || r.every((c) => c === null || c === "")) continue;
      const g = (k: keyof typeof col) => (col[k] >= 0 ? r[col[k]] : null);

      const cliente = String(g("cliente") ?? "").trim();
      // La plantilla trae una fila de ejemplo que debe ignorarse.
      if (norm(cliente).startsWith("ejemplo")) {
        omitidas++;
        continue;
      }
      const fecha = parseFecha(g("fecha"), (n) => {
        const o = XLSX.SSF.parse_date_code(n);
        return o ? { y: o.y, m: o.m, d: o.d } : null;
      });
      const producto = String(g("producto") ?? "").trim();
      const unidades = parseNumero(g("unidades"));
      let valor = parseNumero(g("valor"));
      const precio = parseNumero(g("precio"));
      if (valor === null && unidades !== null && precio !== null) valor = unidades * precio;

      const problemas: string[] = [];
      if (!fecha || !fechaReal(fecha)) problemas.push("fecha");
      if (!cliente) problemas.push("cliente");
      if (!producto) problemas.push("producto");
      if (unidades === null) problemas.push("unidades");
      if (valor === null) problemas.push("valor");
      if (problemas.length) {
        errores.push(`Fila ${i + 1}: falta o no se entiende ${problemas.join(", ")}`);
        continue;
      }

      filas.push({
        fecha: fecha as string,
        cliente,
        canal: String(g("canal") ?? "").trim(),
        ciudad: String(g("ciudad") ?? "").trim(),
        producto,
        unidades: unidades as number,
        valor: Math.round(valor as number),
      });
    }
  }

  return { archivo: file.name, hoja: nombre, filas, errores, faltantes, omitidas };
}
