"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatCOP } from "@/lib/precios";
import { pkey } from "@/lib/texto";
import type { VentaMes, VentaResumenFila, VentaTotales } from "@/lib/types/venta";
import {
  MAX_FILAS_CARGA,
  leerArchivoVentas,
  type VistaPreviaCarga,
} from "@/lib/ventas-excel";
import { mesCorto, mesLargo } from "@/lib/ventas-periodo";

type Props = {
  meses: VentaMes[];
  cargaFallida: boolean;
  periodoInicial: string;
  totalesIniciales: VentaTotales | null;
  filasIniciales: VentaResumenFila[];
  /** Productos del catálogo con su clave de cruce (`pkey(nombre)`). */
  catalogo: Array<{ clave: string; id: string }>;
  puedeCargar: boolean;
};

type Pestana = "cliente" | "producto";

const fieldClass =
  "min-h-11 rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60";

const fmtN = (n: number) => Math.round(n || 0).toLocaleString("es-CO");

function fechaHora(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VentasPanel({
  meses,
  cargaFallida,
  periodoInicial,
  totalesIniciales,
  filasIniciales,
  catalogo,
  puedeCargar,
}: Props) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [pestana, setPestana] = useState<Pestana>("cliente");
  const [totales, setTotales] = useState(totalesIniciales);
  const [filas, setFilas] = useState(filasIniciales);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<VentaResumenFila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [subida, setSubida] = useState<VistaPreviaCarga | null>(null);
  const [agregarDesconocidos, setAgregarDesconocidos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mesBorrar, setMesBorrar] = useState<string | null>(null);

  const mesesOrdenados = [...meses].map((m) => m.mes).sort();
  const anios = [...new Set(mesesOrdenados.map((m) => m.slice(0, 4)))].sort().reverse();

  const consultar = useCallback(async (p: string, por: Pestana) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ventas/resumen?periodo=${encodeURIComponent(p)}&por=${por}`,
      );
      const json = (await res.json().catch(() => null)) as {
        totales?: VentaTotales;
        filas?: VentaResumenFila[];
        error?: string;
      } | null;
      if (!res.ok || !json?.filas || !json.totales) {
        throw new Error(json?.error ?? "No se pudo cargar las ventas.");
      }
      setTotales(json.totales);
      setFilas(json.filas);
      setAbierto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }, []);

  // Los datos iniciales ya vienen del servidor para «12m / cliente»; solo se vuelve a
  // consultar cuando el usuario cambia el período o la pestaña.
  useEffect(() => {
    if (periodo === periodoInicial && pestana === "cliente") {
      setTotales(totalesIniciales);
      setFilas(filasIniciales);
      return;
    }
    void consultar(periodo, pestana);
  }, [periodo, pestana, periodoInicial, totalesIniciales, filasIniciales, consultar]);

  async function expandirCliente(cliente: string) {
    if (abierto === cliente) {
      setAbierto(null);
      return;
    }
    setAbierto(cliente);
    setDetalle([]);
    try {
      const res = await fetch(
        `/api/ventas/resumen?periodo=${encodeURIComponent(periodo)}&por=cliente&cliente=${encodeURIComponent(cliente)}`,
      );
      const json = (await res.json().catch(() => null)) as { filas?: VentaResumenFila[] } | null;
      setDetalle(json?.filas ?? []);
    } catch {
      setDetalle([]);
    }
  }

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAviso(null);
    try {
      setSubida(await leerArchivoVentas(file));
    } catch {
      setError("No pude leer el archivo. ¿Es un Excel válido?");
    }
  }

  async function guardarCarga() {
    if (!subida || !puedeCargar) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/ventas/cargar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivo: subida.archivo,
          agregar_productos: agregarDesconocidos,
          filas: subida.filas,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; filas?: number } | null;
      if (!res.ok) throw new Error(json?.error ?? "No se pudieron guardar las ventas.");
      setAviso(`${fmtN(json?.filas ?? subida.filas.length)} filas guardadas.`);
      setSubida(null);
      setPeriodo("12m");
      setPestana("cliente");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar las ventas.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarMes(mes: string) {
    setError(null);
    try {
      const res = await fetch(`/api/ventas/meses/${mes}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo eliminar el mes.");
      setMesBorrar(null);
      setAviso(`${mesLargo(mes)} eliminado.`);
      setPeriodo("12m");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el mes.");
    }
  }

  const total = totales?.valor ?? 0;
  const unidades = totales?.unidades ?? 0;
  const conocidos = new Set(catalogo.map((c) => c.clave));
  const idPorClave = new Map(catalogo.map((c) => [c.clave, c.id]));

  // Vista previa de la carga (as-is uploadPreview).
  const previa = subida
    ? (() => {
        const mesesArchivo = [...new Set(subida.filas.map((r) => r.fecha.slice(0, 7)))].sort();
        const existentes = mesesArchivo.filter((m) => meses.some((x) => x.mes === m));
        const desconocidos = [
          ...new Map(
            subida.filas
              .filter((r) => !conocidos.has(pkey(r.producto)))
              .map((r) => [pkey(r.producto), r.producto]),
          ).values(),
        ];
        return {
          mesesArchivo,
          existentes,
          desconocidos,
          valor: subida.filas.reduce((a, r) => a + r.valor, 0),
          clientes: new Set(subida.filas.map((r) => r.cliente)).size,
          excede: subida.filas.length > MAX_FILAS_CARGA,
        };
      })()
    : null;

  const panelCarga = puedeCargar ? (
    <section className="space-y-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-paramo-display text-lg font-bold text-paramo-fg">
            Cargar ventas desde Excel
          </h2>
          <p className="text-xs text-paramo-muted">
            Una fila por cliente, producto y fecha. Si el mes ya existe, se reemplaza.
          </p>
        </div>
        <a
          href="/Plantilla_Ventas_Paramo.xlsx"
          download
          className={`${btnSmall} border border-paramo-line text-paramo-fg hover:bg-paramo-surface-2`}
        >
          Descargar plantilla
        </a>
      </div>

      {!subida ? (
        <label
          htmlFor="ventas-archivo"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border border-dashed border-paramo-line p-6 text-center hover:border-paramo-teal"
        >
          <b className="text-paramo-fg">Haz clic para elegir tu archivo</b>
          <span className="text-xs text-paramo-muted">
            .xlsx, .xls o .csv con los encabezados de la plantilla
          </span>
          <input
            id="ventas-archivo"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              void elegirArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      ) : previa ? (
        <div className="space-y-3">
          <div className="text-sm">
            <b className="text-paramo-fg">{subida.archivo}</b>{" "}
            <span className="text-paramo-muted">· hoja «{subida.hoja}»</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Mini valor={fmtN(subida.filas.length)} texto="filas válidas" />
            <Mini
              valor={String(previa.mesesArchivo.length)}
              texto={`${previa.mesesArchivo.length === 1 ? "mes" : "meses"}: ${previa.mesesArchivo.map(mesCorto).join(", ")}`}
            />
            <Mini valor={formatCOP(previa.valor)} texto="valor total" />
            <Mini valor={String(previa.clientes)} texto="clientes" />
          </div>
          {subida.faltantes.length ? (
            <p className="rounded-[10px] border border-paramo-bad p-3 text-sm text-paramo-fg" role="alert">
              <b>Faltan columnas obligatorias:</b> {subida.faltantes.join(", ")}. Revisa que la
              fila de encabezados sea la de la plantilla.
            </p>
          ) : null}
          {subida.errores.length ? (
            <div className="rounded-[10px] border border-paramo-bad p-3 text-sm text-paramo-fg" role="alert">
              <b>
                {subida.errores.length}{" "}
                {subida.errores.length === 1 ? "fila no se cargará" : "filas no se cargarán"}:
              </b>
              <ul className="ml-5 list-disc">
                {subida.errores.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {subida.errores.length > 6 ? `… y ${subida.errores.length - 6} más.` : null}
            </div>
          ) : null}
          {previa.excede ? (
            <p className="rounded-[10px] border border-paramo-bad p-3 text-sm text-paramo-fg" role="alert">
              El archivo tiene más de {fmtN(MAX_FILAS_CARGA)} filas. Divídelo en varios archivos.
            </p>
          ) : null}
          {subida.omitidas ? (
            <p className="text-xs text-paramo-muted">
              Se omitieron {subida.omitidas} filas de ejemplo.
            </p>
          ) : null}
          {previa.desconocidos.length ? (
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] bg-paramo-teal-soft p-3 text-sm text-paramo-teal-ink">
              <span className="mr-auto">
                <b>
                  {previa.desconocidos.length}{" "}
                  {previa.desconocidos.length === 1 ? "producto no está" : "productos no están"} en
                  el catálogo:
                </b>{" "}
                {previa.desconocidos.slice(0, 6).join(", ")}
                {previa.desconocidos.length > 6 ? "…" : ""}
              </span>
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={agregarDesconocidos}
                  onChange={(e) => setAgregarDesconocidos(e.target.checked)}
                />
                Agregarlos al catálogo al guardar
              </label>
            </div>
          ) : null}
          {previa.existentes.length ? (
            <p className="rounded-[10px] border border-paramo-warn p-3 text-sm text-paramo-fg">
              Ya existen datos de <b>{previa.existentes.map(mesLargo).join(", ")}</b>. Al
              confirmar, esos meses se reemplazan por los del archivo.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={guardando}
              onClick={() => setSubida(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={
                guardando ||
                subida.filas.length === 0 ||
                subida.faltantes.length > 0 ||
                previa.excede
              }
              onClick={guardarCarga}
            >
              {guardando ? "Guardando…" : `Guardar ${fmtN(subida.filas.length)} filas`}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  ) : null;

  const panelMeses = (
    <section className="space-y-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
          Meses cargados
        </h2>
        <span className="text-xs text-paramo-muted">
          {meses.length} {meses.length === 1 ? "mes" : "meses"}
        </span>
      </div>
      {meses.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                <th className="px-3 py-2">Mes</th>
                <th className="px-3 py-2 text-right">Filas</th>
                <th className="px-3 py-2 text-right">Unidades</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b border-paramo-line last:border-b-0">
                  <td className="px-3 py-2 font-bold text-paramo-fg">{mesLargo(m.mes)}</td>
                  <td className="px-3 py-2 text-right">{fmtN(m.filas)}</td>
                  <td className="px-3 py-2 text-right">{fmtN(m.unidades)}</td>
                  <td className="px-3 py-2 text-right">{formatCOP(m.valor)}</td>
                  <td className="px-3 py-2 text-xs text-paramo-muted">
                    {m.archivo}
                    <br />
                    {fechaHora(m.cargado_en)}
                    {m.cargado_por_nombre !== "—" ? ` · ${m.cargado_por_nombre}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!puedeCargar ? null : mesBorrar === m.mes ? (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          className={`${btnSmall} border border-paramo-bad text-paramo-bad`}
                          onClick={() => eliminarMes(m.mes)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className={`${btnSmall} border border-paramo-line text-paramo-fg`}
                          onClick={() => setMesBorrar(null)}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`${btnSmall} text-paramo-muted hover:bg-paramo-surface-2`}
                        onClick={() => setMesBorrar(m.mes)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-paramo-muted">Todavía no se han cargado ventas.</p>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">Ventas</h1>
        <p className="text-sm text-paramo-muted">Ventas por cliente y por producto</p>
      </header>

      {aviso ? (
        <p className="text-sm text-paramo-good" role="status">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}
      {cargaFallida ? (
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudieron cargar las ventas. Revisa que la migración de ventas esté aplicada en
          Supabase.
        </p>
      ) : null}

      {meses.length ? (
        <section className="space-y-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-paramo-display text-lg font-bold text-paramo-fg">
              Análisis de ventas
            </h2>
            <span className="text-xs text-paramo-muted">
              {formatCOP(total)} · {fmtN(unidades)} unidades · {fmtN(totales?.clientes ?? 0)}{" "}
              clientes
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Período"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className={fieldClass}
            >
              <option value="12m">Últimos 12 meses</option>
              {anios.map((y) => (
                <option key={y} value={y}>
                  Año {y}
                </option>
              ))}
              {[...mesesOrdenados].reverse().map((m) => (
                <option key={m} value={m}>
                  {mesLargo(m)}
                </option>
              ))}
            </select>
            <div
              role="group"
              aria-label="Agrupar"
              className="inline-flex gap-1 rounded-full border border-paramo-line bg-paramo-surface p-1"
            >
              {(
                [
                  ["cliente", "Por cliente"],
                  ["producto", "Por producto"],
                ] as Array<[Pestana, string]>
              ).map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={pestana === k}
                  onClick={() => setPestana(k)}
                  className={`min-h-9 rounded-full px-3 text-xs font-bold ${
                    pestana === k
                      ? "bg-paramo-brand text-paramo-brand-ink"
                      : "text-paramo-muted hover:bg-paramo-surface-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {cargando ? <span className="text-xs text-paramo-muted">Cargando…</span> : null}
          </div>

          <div className="overflow-x-auto">
            {pestana === "cliente" ? (
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2 text-right">Unidades</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Part.</th>
                    <th className="px-3 py-2 text-right">Última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((o) => {
                    const abiertoFila = abierto === o.clave;
                    const maximo = detalle[0]?.valor ?? 0;
                    return (
                      <FilaCliente
                        key={o.clave}
                        o={o}
                        total={total}
                        abierto={abiertoFila}
                        detalle={detalle}
                        maximo={maximo}
                        onToggle={() => expandirCliente(o.clave)}
                      />
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-paramo-line font-bold text-paramo-fg">
                    <td className="px-3 py-2">Total</td>
                    <td />
                    <td className="px-3 py-2 text-right">{fmtN(unidades)}</td>
                    <td className="px-3 py-2 text-right">{formatCOP(total)}</td>
                    <td className="px-3 py-2 text-right">100%</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-right">Unidades</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Part.</th>
                    <th className="px-3 py-2 text-right">Precio prom.</th>
                    <th className="px-3 py-2 text-right">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((o) => (
                    <tr key={o.clave} className="border-b border-paramo-line last:border-b-0">
                      <td className="px-3 py-2 font-bold text-paramo-fg">
                        {idPorClave.get(o.clave) ? (
                          <Link
                            href={`/productos?abrir=${idPorClave.get(o.clave)}`}
                            className="text-paramo-teal-ink hover:underline"
                          >
                            {o.etiqueta}
                          </Link>
                        ) : (
                          o.etiqueta
                        )}{" "}
                        {conocidos.size && !conocidos.has(o.clave) ? (
                          <span
                            className="ml-1 rounded-full border border-paramo-line px-2 py-0.5 text-[10px] font-bold text-paramo-muted"
                            title="No está en el catálogo"
                          >
                            fuera de catálogo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtN(o.unidades)}</td>
                      <td className="px-3 py-2 text-right">{formatCOP(o.valor)}</td>
                      <td className="px-3 py-2 text-right">
                        {total ? ((o.valor / total) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {o.unidades ? formatCOP(o.valor / o.unidades) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtN(o.clientes)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-paramo-line font-bold text-paramo-fg">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{fmtN(unidades)}</td>
                    <td className="px-3 py-2 text-right">{formatCOP(total)}</td>
                    <td className="px-3 py-2 text-right">100%</td>
                    <td className="px-3 py-2 text-right">
                      {unidades ? formatCOP(total / unidades) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>
      ) : null}

      {panelCarga}
      {panelMeses}
    </div>
  );
}

function Mini({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="rounded-[10px] border border-paramo-line p-3">
      <b className="block font-paramo-display text-lg text-paramo-fg">{valor}</b>
      <span className="text-xs text-paramo-muted">{texto}</span>
    </div>
  );
}

function FilaCliente({
  o,
  total,
  abierto,
  detalle,
  maximo,
  onToggle,
}: {
  o: VentaResumenFila;
  total: number;
  abierto: boolean;
  detalle: VentaResumenFila[];
  maximo: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-paramo-line hover:bg-paramo-surface-2"
        onClick={onToggle}
      >
        <td className="px-3 py-2 font-bold text-paramo-fg">
          <button
            type="button"
            aria-expanded={abierto}
            className="text-left focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {abierto ? "▾" : "▸"} {o.etiqueta}
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-paramo-muted">{o.canal || "—"}</td>
        <td className="px-3 py-2 text-right">{fmtN(o.unidades)}</td>
        <td className="px-3 py-2 text-right">{formatCOP(o.valor)}</td>
        <td className="px-3 py-2 text-right">
          {total ? ((o.valor / total) * 100).toFixed(1) : 0}%
        </td>
        <td className="px-3 py-2 text-right text-xs text-paramo-muted">
          {o.ultima ? mesCorto(o.ultima.slice(0, 7)) : "—"}
        </td>
      </tr>
      {abierto ? (
        <tr className="border-b border-paramo-line bg-paramo-surface-2">
          <td colSpan={6} className="px-3 py-2">
            {detalle.length === 0 ? (
              <span className="text-xs text-paramo-muted">Cargando…</span>
            ) : (
              <ul className="space-y-1">
                {detalle.map((x) => (
                  <li key={x.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="truncate text-sm text-paramo-fg">
                      {x.etiqueta}{" "}
                      <span className="text-xs text-paramo-muted">· {fmtN(x.unidades)} u</span>
                    </span>
                    <span className="text-sm font-bold text-paramo-fg">{formatCOP(x.valor)}</span>
                    <span
                      className="col-span-2 block h-1 rounded-full bg-paramo-teal"
                      style={{ width: `${maximo ? (x.valor / maximo) * 100 : 0}%` }}
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
