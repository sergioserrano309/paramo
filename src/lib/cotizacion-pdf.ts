import { EMPRESA } from "@/config/empresa";
import { ESTADOS_FINALES } from "@/config/cotizaciones";
import { calcularTotales } from "@/lib/cotizaciones-calculo";
import { sumarDias } from "@/lib/fechas";
import type { ContactoCliente, CotizacionListItem } from "@/lib/types/cotizacion";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

type RGB = [number, number, number];
// Colores de marca del as-is (paramo-brand, paramo-teal, paramo-muted, paramo-fg). jsPDF
// no lee tokens CSS, por eso van como RGB.
const PL: RGB = [138, 42, 102];
const TE: RGB = [84, 150, 126];
const GR: RGB = [100, 107, 115];
const INK: RGB = [31, 35, 40];

const money = (n: number) => "$ " + Math.round(n || 0).toLocaleString("es-CO");

function fechaLarga(s: string): string {
  const d = new Date(`${s}T12:00:00`);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

async function cargarLogo(): Promise<string | null> {
  try {
    const res = await fetch(EMPRESA.logo);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("logo"));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * PDF de la cotización (as-is quotePDF). jsPDF se importa bajo demanda para no cargarlo
 * en el bundle de quien no genera PDFs. Marca de agua si aún no es versión final.
 */
export async function descargarCotizacionPdf(args: {
  cot: CotizacionListItem;
  contacto: ContactoCliente | null;
  tipoClienteNombre: string;
}): Promise<void> {
  const { cot, contacto, tipoClienteNombre } = args;
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    cargarLogo(),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 16;
  const fin = ESTADOS_FINALES.includes(cot.estado);
  const t = calcularTotales(cot.items, cot.desc_pct, cot.iva_pct);

  if (logo) {
    try {
      doc.addImage(logo, "JPEG", M, 9, 30, 22.4);
    } catch {
      // Sin logo el PDF sigue siendo válido.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PL);
  doc.text("COTIZACIÓN", W - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GR);
  doc.text(
    `${cot.numero}${fin && cot.version ? `  ·  versión ${cot.version}` : ""}`,
    W - M,
    24.5,
    { align: "right" },
  );
  doc.text(`Fecha: ${fechaLarga(cot.fecha)}`, W - M, 29.5, { align: "right" });
  doc.setDrawColor(...TE);
  doc.setLineWidth(0.9);
  doc.line(M, 36, W - M, 36);

  const colW = (W - 2 * M - 8) / 2;
  let y = 44;
  const label = (txt: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TE);
    doc.text(txt, x, yy);
  };
  label("CLIENTE", M, y);
  label("CONDICIONES COMERCIALES", M + colW + 8, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(cot.cliente_nombre, colW), M, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GR);
  const p = contacto;
  const lineasCliente = [
    p?.nit ? `NIT ${p.nit}` : "",
    [p?.contacto, p?.cargo].filter(Boolean).join(" · "),
    [p?.telefono, p?.email].filter(Boolean).join(" · "),
    p?.ciudad ?? "",
  ].filter(Boolean);
  lineasCliente.forEach((l, i) => {
    doc.text(doc.splitTextToSize(l, colW)[0] ?? "", M, y + 12 + i * 5);
  });

  const condiciones: Array<[string, string]> = [
    ["Tipo de cliente", tipoClienteNombre],
    ["Válida hasta", fechaLarga(sumarDias(cot.fecha, cot.validez_dias))],
    ["Forma de pago", cot.pago],
    ["Entrega", cot.entrega || "Por acordar"],
    ["Asesor comercial", cot.creado_por_nombre],
  ];
  condiciones.forEach(([k, v], i) => {
    const yy = y + 6 + i * 5.2;
    doc.setTextColor(...GR);
    doc.text(k, M + colW + 8, yy);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(String(v), colW - 36)[0] ?? "", M + colW + 8 + 36, yy);
  });
  y = Math.max(y + 12 + lineasCliente.length * 5, y + 6 + condiciones.length * 5.2) + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["#", "Producto", "Presentación", "Caja", "Cant.", "Precio unit.", "Total"]],
    body: cot.items.map((it, i) => [
      i + 1,
      it.nombre,
      it.presentacion || "",
      it.caja ? it.caja.replace("Tipo ", "") : "—",
      Math.round(it.cant).toLocaleString("es-CO"),
      money(it.precio),
      money(it.cant * it.precio),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.6,
      textColor: INK,
      lineColor: [226, 229, 233],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: PL, textColor: 255, fontStyle: "bold", lineWidth: 0 },
    alternateRowStyles: { fillColor: [247, 248, 249] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      2: { cellWidth: 26 },
      3: { cellWidth: 13, halign: "center" },
      4: { cellWidth: 16, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
  });

  const ultima = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  y = ultima.finalY + 7;
  if (y > H - 90) {
    doc.addPage();
    y = 24;
  }

  const tx = W - M - 78;
  const tw = 78;
  const filas: Array<[string, string]> = [
    ["Subtotal", money(t.sub)],
    [`Descuento (${t.d}%)`, "- " + money(t.dv)],
    ["Base", money(t.base)],
    [`IVA (${cot.iva_pct}%)`, money(t.iva)],
  ];
  doc.setFontSize(9.5);
  filas.forEach(([k, v], i) => {
    const yy = y + i * 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GR);
    doc.text(k, tx + 3, yy);
    doc.setTextColor(...INK);
    doc.text(v, tx + tw - 3, yy, { align: "right" });
  });
  const gy = y + filas.length * 6 - 1;
  doc.setFillColor(...PL);
  doc.roundedRect(tx, gy, tw, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(255);
  doc.text("TOTAL", tx + 4, gy + 7.3);
  doc.text(money(t.tot), tx + tw - 4, gy + 7.3, { align: "right" });

  const ny = y - 1;
  const nw = W - 2 * M - tw - 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TE);
  doc.text("OBSERVACIONES", M, ny);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GR);
  const notas = [
    cot.notas,
    `Precios en pesos colombianos (COP). Cotización válida por ${cot.validez_dias} días.`,
  ]
    .filter(Boolean)
    .join("\n");
  const nl = doc.splitTextToSize(notas, nw);
  doc.text(nl, M, ny + 5);
  let ey = Math.max(gy + 18, ny + 5 + nl.length * 4.4 + 6);
  if (cot.aprobacion && fin) {
    doc.setFontSize(8.5);
    doc.setTextColor(...TE);
    doc.text(
      `Descuento especial de ${cot.aprobacion.desc}% autorizado por ${cot.aprobacion.por_nombre} el ${new Date(cot.aprobacion.en).toLocaleDateString("es-CO")}.`,
      M,
      ey,
    );
    ey += 6;
  }

  if (ey < H - 48) {
    doc.setDrawColor(200, 204, 209);
    doc.setLineWidth(0.3);
    doc.line(M, H - 46, M + 70, H - 46);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(cot.creado_por_nombre, M, H - 41);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GR);
    doc.text(`Asesor comercial · ${EMPRESA.nombrePdf}`, M, H - 36.5);
  }

  const paginas = doc.getNumberOfPages();
  if (!fin) {
    const marca = cot.estado === "pendiente" ? "PENDIENTE DE APROBACIÓN" : "BORRADOR";
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      try {
        doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.1 }));
      } catch {
        // Sin transparencia la marca queda más fuerte, pero legible.
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(cot.estado === "pendiente" ? 30 : 60);
      doc.setTextColor(...PL);
      const ww = doc.getTextWidth(marca);
      const ang = (30 * Math.PI) / 180;
      doc.text(marca, W / 2 - (Math.cos(ang) * ww) / 2, H / 2 + (Math.sin(ang) * ww) / 2, {
        angle: 30,
      });
      try {
        doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }));
      } catch {
        // ver arriba
      }
    }
  }

  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...TE);
    doc.setLineWidth(0.6);
    doc.line(M, H - 22, W - M, H - 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PL);
    doc.text(EMPRESA.nombrePdf, M, H - 16.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GR);
    doc.text(EMPRESA.contacto, M, H - 12);
    doc.setFont("helvetica", "italic");
    doc.text(EMPRESA.lema, M, H - 7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 16.5, { align: "right" });
  }

  doc.save(`${cot.numero}_${slug(cot.cliente_nombre) || "cliente"}${fin ? "" : "_borrador"}.pdf`);
}
