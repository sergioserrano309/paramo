"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  ESTADOS_PRODUCTO,
  LINEAS_PRODUCTO,
  PCT_MAX_PRODUCTO,
  TIPO_CLIENTE_PVP,
  estadoProducto,
  nombreLinea,
} from "@/config/productos";
import Link from "next/link";
import { formatMoneyShort } from "@/lib/format";
import type {
  InteresadoProducto,
  OpinionProducto,
  ResumenSeguimiento,
} from "@/lib/productos-seguimiento";
import { pkey } from "@/lib/texto";
import { mesCorto } from "@/lib/ventas-periodo";
import {
  formatCOP,
  normalizarPrecio,
  precioDesdeDefinicion,
  precioListaGeneral,
  textoPrecio,
} from "@/lib/precios";
import type {
  ModoPrecio,
  ProductoListItem,
  TipoClientePrecio,
} from "@/lib/types/producto";

type ProductosPanelProps = {
  initialProductos: ProductoListItem[];
  tiposCliente: TipoClientePrecio[];
  cargaFallida: boolean;
  /** Ventas de los últimos 12 meses cargados por `pkey(nombre)`. */
  ventas12m: Record<string, number>;
  /** Interesados y opiniones por id de producto. */
  resumen: Record<string, ResumenSeguimiento>;
  abrirInicial: string;
  canEdit: boolean;
  canApprove: boolean;
  esSupervisor: boolean;
};

type SeguimientoVentas = {
  valor: number;
  unidades: number;
  clientes: number;
  por_mes: Array<{ mes: string; valor: number }>;
  top_clientes: Array<{ cliente: string; valor: number }>;
};

type PrecioForm = { modo: ModoPrecio; v: string };

type FormState = {
  nombre: string;
  precio_publico: string;
  linea: string;
  estado: string;
  presentacion: string;
  sku: string;
  codigo: string;
  descripcion: string;
  precios: Record<string, PrecioForm>;
};

const TONO_PUNTO: Record<string, string> = {
  olive: "bg-paramo-olive",
  brand: "bg-paramo-brand",
  teal: "bg-paramo-teal",
  muted: "bg-paramo-muted",
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60";

function EstadoPill({ estado }: { estado: string }) {
  const e = estadoProducto(estado);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-paramo-line px-2 py-0.5 text-xs font-bold text-paramo-fg">
      <i
        className={`inline-block size-2 rounded-full ${TONO_PUNTO[e.tono] ?? "bg-paramo-muted"}`}
        aria-hidden="true"
      />
      {e.nombre}
    </span>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formVacio(tipos: TipoClientePrecio[]): FormState {
  const precios: Record<string, PrecioForm> = {};
  for (const t of tipos) {
    if (t.codigo !== TIPO_CLIENTE_PVP) precios[t.codigo] = { modo: "pct", v: "" };
  }
  return {
    nombre: "",
    precio_publico: "",
    linea: "frutas",
    estado: "desarrollo",
    presentacion: "",
    sku: "",
    codigo: "",
    descripcion: "",
    precios,
  };
}

/** Como el as-is: muestra lo pendiente si existe; si no, lo vigente en firme. */
function formDesdeProducto(
  p: ProductoListItem,
  tipos: TipoClientePrecio[],
): FormState {
  const base = formVacio(tipos);
  for (const t of tipos) {
    if (t.codigo === TIPO_CLIENTE_PVP) continue;
    const pend = p.precios_pendientes[t.codigo];
    const cur = pend
      ? normalizarPrecio({ modo: pend.modo, v: pend.v })
      : normalizarPrecio(p.precios[t.codigo]);
    base.precios[t.codigo] = cur
      ? { modo: cur.modo, v: String(cur.v) }
      : { modo: "pct", v: "" };
  }
  return {
    ...base,
    nombre: p.nombre,
    precio_publico: String(p.precio_publico || ""),
    linea: p.linea,
    estado: p.estado,
    presentacion: p.presentacion,
    sku: p.sku,
    codigo: p.codigo,
    descripcion: p.descripcion,
  };
}

export function ProductosPanel({
  initialProductos,
  tiposCliente,
  cargaFallida,
  ventas12m,
  resumen,
  abrirInicial,
  canEdit,
  canApprove,
  esSupervisor,
}: ProductosPanelProps) {
  const titleId = useId();
  const [productos, setProductos] = useState(initialProductos);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [q, setQ] = useState("");
  // null = cerrado; "nuevo" = alta; uuid = edición de ese producto.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => formVacio(tiposCliente));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);
  const [seguimiento, setSeguimiento] = useState<SeguimientoVentas | null>(null);
  const [opinionesData, setOpinionesData] = useState<{
    interesados: InteresadoProducto[];
    opiniones: OpinionProducto[];
  } | null>(null);

  // Llegada con `?abrir=ID` (bitácora, ventas…): abre la ficha de ese producto.
  useEffect(() => {
    if (!abrirInicial) return;
    const p = initialProductos.find((x) => x.id === abrirInicial);
    if (p) abrirProducto(p);
    // Solo al montar: después el usuario controla el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProductos(initialProductos);
  }, [initialProductos]);

  // Seguimiento de ventas del producto abierto (últimos 12 meses cargados).
  useEffect(() => {
    setSeguimiento(null);
    setOpinionesData(null);
    if (!abierto || abierto === "nuevo") return;
    let cancelado = false;
    fetch(`/api/productos/${abierto}/ventas`)
      .then((r) => (r.ok ? (r.json() as Promise<SeguimientoVentas>) : null))
      .then((j) => {
        if (!cancelado && j) setSeguimiento(j);
      })
      .catch(() => {});
    fetch(`/api/productos/${abierto}/seguimiento`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelado && j) setOpinionesData(j);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const tiposPrecio = useMemo(
    () => tiposCliente.filter((t) => t.codigo !== TIPO_CLIENTE_PVP),
    [tiposCliente],
  );
  const actual = abierto && abierto !== "nuevo"
    ? (productos.find((p) => p.id === abierto) ?? null)
    : null;
  const esNuevo = abierto === "nuevo";
  const editable = canEdit;

  function cerrar() {
    setAbierto(null);
    setError(null);
    setConfirmaBorrar(false);
  }

  function abrirNuevo() {
    setError(null);
    setAviso(null);
    setConfirmaBorrar(false);
    setForm(formVacio(tiposCliente));
    setAbierto("nuevo");
  }

  function abrirProducto(p: ProductoListItem) {
    setError(null);
    setAviso(null);
    setConfirmaBorrar(false);
    setForm(formDesdeProducto(p, tiposCliente));
    setAbierto(p.id);
  }

  function setCampo<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPrecio(tipo: string, parche: Partial<PrecioForm>) {
    setForm((prev) => ({
      ...prev,
      precios: { ...prev.precios, [tipo]: { ...prev.precios[tipo], ...parche } },
    }));
  }

  /** As-is ppFill: rellena con la lista general los tipos que están vacíos. */
  function llenarConListaGeneral() {
    setForm((prev) => {
      const precios = { ...prev.precios };
      for (const t of tiposPrecio) {
        if (precios[t.codigo]?.v === "") {
          precios[t.codigo] = { modo: "pct", v: String(t.descuento_pct) };
        }
      }
      return { ...prev, precios };
    });
  }

  function guardarEnLista(p: ProductoListItem) {
    setProductos((prev) => {
      const existe = prev.some((x) => x.id === p.id);
      const next = existe ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
      return next.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
  }

  function payload() {
    const precios: Record<string, { modo: ModoPrecio; v: number } | null> = {};
    for (const t of tiposPrecio) {
      const f = form.precios[t.codigo];
      const raw = f?.v.trim() ?? "";
      precios[t.codigo] = raw === "" ? null : { modo: f.modo, v: Number(raw) };
    }
    return {
      nombre: form.nombre.trim(),
      precio_publico: Number(form.precio_publico) || 0,
      linea: form.linea,
      estado: form.estado,
      presentacion: form.presentacion,
      sku: form.sku,
      codigo: form.codigo,
      descripcion: form.descripcion,
      precios,
    };
  }

  async function llamar<T>(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as
      | (T & { error?: string })
      | null;
    if (!res.ok || !json) {
      throw new Error(json?.error ?? "No se pudo completar la acción.");
    }
    return json;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    setError(null);
    setAviso(null);

    const data = payload();
    if (!data.nombre) {
      setError("Escribe el nombre del producto.");
      return;
    }
    if (!(data.precio_publico > 0)) {
      setError("Escribe el PVP del producto.");
      return;
    }

    setCargando(true);
    try {
      if (esNuevo) {
        const res = await llamar<{ producto: ProductoListItem }>(
          "/api/productos",
          "POST",
          data,
        );
        guardarEnLista(res.producto);
        setForm(formDesdeProducto(res.producto, tiposCliente));
        setAbierto(res.producto.id);
        setAviso(
          esSupervisor
            ? `${res.producto.nombre} creado con precios en firme.`
            : `${res.producto.nombre} creado; precios enviados a aprobación.`,
        );
      } else if (actual) {
        const res = await llamar<{
          producto: ProductoListItem;
          precios_pendientes_nuevos: boolean;
        }>(`/api/productos/${actual.id}`, "PATCH", data);
        guardarEnLista(res.producto);
        setForm(formDesdeProducto(res.producto, tiposCliente));
        setAviso(
          res.precios_pendientes_nuevos
            ? "Guardado: los precios quedan pendientes de aprobación."
            : "Producto guardado.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el producto.");
    } finally {
      setCargando(false);
    }
  }

  async function resolverPrecio(tipo: string, accion: "aprobar" | "rechazar") {
    if (!actual || !canApprove) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const res = await llamar<{ producto: ProductoListItem }>(
        `/api/productos/${actual.id}/precios`,
        "POST",
        { accion, tipo },
      );
      guardarEnLista(res.producto);
      setForm(formDesdeProducto(res.producto, tiposCliente));
      setAviso(accion === "aprobar" ? "Precio aprobado." : "Precio rechazado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver el precio.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminar() {
    if (!actual || !editable) return;
    setError(null);
    setCargando(true);
    try {
      await llamar<{ ok: true }>(`/api/productos/${actual.id}`, "DELETE");
      setProductos((prev) => prev.filter((p) => p.id !== actual.id));
      cerrar();
      setAviso("Producto eliminado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el producto.");
    } finally {
      setCargando(false);
    }
  }

  const conteo = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of ESTADOS_PRODUCTO) {
      out[e.codigo] = productos.filter((p) => p.estado === e.codigo).length;
    }
    return out;
  }, [productos]);

  const lista = useMemo(() => {
    const term = q.trim().toLowerCase();
    return productos
      .filter((p) => !filtroEstado || p.estado === filtroEstado)
      .filter(
        (p) =>
          !term ||
          [p.nombre, p.sku, p.codigo, nombreLinea(p.linea)].join(" ").toLowerCase().includes(term),
      )
      .sort((a, b) => {
        const oa = estadoProducto(a.estado).orden;
        const ob = estadoProducto(b.estado).orden;
        return oa - ob || a.nombre.localeCompare(b.nombre, "es");
      });
  }, [productos, filtroEstado, q]);

  const pvp = Number(form.precio_publico) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
            Productos
          </h1>
          <p className="text-sm text-paramo-muted">
            {productos.length} referencias ·{" "}
            {(conteo.desarrollo ?? 0) + (conteo.lanzamiento ?? 0)} en desarrollo o
            lanzamiento
          </p>
        </header>
        {canEdit ? (
          <button type="button" onClick={abrirNuevo} className={btnPrimary}>
            Producto
          </button>
        ) : null}
      </div>

      {aviso && !abierto ? (
        <p className="text-sm text-paramo-good" role="status">
          {aviso}
        </p>
      ) : null}
      {cargaFallida ? (
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudo cargar el catálogo. Revisa que la migración de productos esté
          aplicada en Supabase.
        </p>
      ) : null}

      {productos.length === 0 && !cargaFallida ? (
        <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-8 text-center">
          <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
            El catálogo está vacío
          </h3>
          <p className="mt-1 text-sm text-paramo-muted">
            {canEdit
              ? "Crea un producto con el botón Producto, o aplica el seed 003_productos.sql con las 21 referencias del sitio."
              : "El comercial aún no ha cargado el catálogo."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Estado"
              className="inline-flex flex-wrap gap-1 rounded-full border border-paramo-line bg-paramo-surface p-1"
            >
              <button
                type="button"
                aria-pressed={!filtroEstado}
                onClick={() => setFiltroEstado("")}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${
                  !filtroEstado
                    ? "bg-paramo-brand text-paramo-brand-ink"
                    : "text-paramo-muted hover:bg-paramo-surface-2"
                }`}
              >
                Todos ({productos.length})
              </button>
              {[...ESTADOS_PRODUCTO]
                .sort((a, b) => a.orden - b.orden)
                .map((e) => (
                  <button
                    key={e.codigo}
                    type="button"
                    aria-pressed={filtroEstado === e.codigo}
                    onClick={() => setFiltroEstado(e.codigo)}
                    className={`min-h-9 rounded-full px-3 text-xs font-bold ${
                      filtroEstado === e.codigo
                        ? "bg-paramo-brand text-paramo-brand-ink"
                        : "text-paramo-muted hover:bg-paramo-surface-2"
                    }`}
                  >
                    {e.nombre}
                    {conteo[e.codigo] ? ` (${conteo[e.codigo]})` : ""}
                  </button>
                ))}
            </div>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto, SKU o código…"
              aria-label="Buscar productos"
              className={`${fieldClass} max-w-md flex-1`}
            />
          </div>

          {lista.length === 0 ? (
            <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-8 text-center">
              <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
                Ningún producto con ese filtro
              </h3>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => {
                const pendientes = Object.keys(p.precios_pendientes).length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => abrirProducto(p)}
                    className="flex flex-col gap-3 rounded-[10px] border border-paramo-line bg-paramo-surface p-4 text-left hover:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-paramo-muted">
                          {nombreLinea(p.linea)}
                          {p.presentacion ? ` · ${p.presentacion}` : ""}
                        </div>
                        <div className="font-paramo-display text-base font-bold text-paramo-fg">
                          {p.nombre}
                        </div>
                      </div>
                      <EstadoPill estado={p.estado} />
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-bold text-paramo-muted">PVP</span>
                      <b className="text-paramo-fg">
                        {p.precio_publico ? formatCOP(p.precio_publico) : "Sin precio"}
                      </b>
                    </div>
                    <div className="text-xs text-paramo-muted">
                      <b className="text-paramo-fg">
                        {ventas12m[pkey(p.nombre)]
                          ? formatMoneyShort(ventas12m[pkey(p.nombre)])
                          : "—"}
                      </b>{" "}
                      ventas 12 m ·{" "}
                      <b className="text-paramo-fg">{resumen[p.id]?.interesados ?? 0}</b>{" "}
                      interesados ·{" "}
                      <b className="text-paramo-fg">
                        {resumen[p.id]?.promedio ? `${resumen[p.id].promedio.toFixed(1)} ★` : "—"}
                      </b>{" "}
                      ({resumen[p.id]?.opiniones ?? 0} opiniones)
                    </div>
                    {pendientes ? (
                      <span className="text-xs font-bold text-paramo-warn">
                        {pendientes} {pendientes === 1 ? "precio" : "precios"} por
                        aprobar
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-paramo-fg/40"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-full w-full max-w-3xl flex-col border-l border-paramo-line bg-paramo-surface shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-paramo-line px-4 py-3">
              <div className="mr-auto min-w-0">
                <h2
                  id={titleId}
                  className="font-paramo-display text-xl font-bold text-paramo-fg"
                >
                  {esNuevo ? "Nuevo producto" : (actual?.nombre ?? "Producto")}
                </h2>
                {actual ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
                    <EstadoPill estado={actual.estado} />
                    {nombreLinea(actual.linea)}
                    {actual.sku ? ` · SKU ${actual.sku}` : ""}
                    {actual.codigo ? ` · Código ${actual.codigo}` : ""}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={cerrar}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg"
              >
                ✕
              </button>
            </div>

            <form
              className="flex flex-1 flex-col gap-5 overflow-y-auto p-4"
              onSubmit={onSubmit}
              noValidate
            >
              {actual ? (
                <section aria-label="Seguimiento" className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-[10px] border border-paramo-line p-3">
                      <b className="block font-paramo-display text-lg text-paramo-fg">
                        {actual.precio_publico ? formatCOP(actual.precio_publico) : "—"}
                      </b>
                      <span className="text-xs text-paramo-muted">PVP · precio venta público</span>
                    </div>
                    <div className="rounded-[10px] border border-paramo-line p-3">
                      <b className="block font-paramo-display text-lg text-paramo-fg">
                        {seguimiento ? formatMoneyShort(seguimiento.valor) : "—"}
                      </b>
                      <span className="text-xs text-paramo-muted">
                        ventas 12 meses
                        {seguimiento ? ` · ${seguimiento.unidades.toLocaleString("es-CO")} u` : ""}
                      </span>
                    </div>
                    <div className="rounded-[10px] border border-paramo-line p-3">
                      <b className="block font-paramo-display text-lg text-paramo-fg">
                        {seguimiento ? seguimiento.clientes : "—"}
                      </b>
                      <span className="text-xs text-paramo-muted">clientes que compran</span>
                    </div>
                  </div>
                  {seguimiento && seguimiento.valor > 0 ? (
                    <>
                      <div>
                        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-paramo-muted">
                          Ventas por mes
                        </h3>
                        <div className="flex h-28 items-end gap-1" role="img" aria-label="Ventas por mes">
                          {(() => {
                            const max = Math.max(...seguimiento.por_mes.map((m) => m.valor), 1);
                            return seguimiento.por_mes.map((m) => (
                              <div
                                key={m.mes}
                                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                                title={`${mesCorto(m.mes)}: ${formatCOP(m.valor)}`}
                              >
                                <div
                                  className="w-full rounded-t bg-paramo-teal"
                                  style={{ height: `${(m.valor / max) * 100}%`, minHeight: m.valor ? 2 : 0 }}
                                />
                                <span className="text-[10px] text-paramo-muted">
                                  {mesCorto(m.mes).split(" ")[0]}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                      <div>
                        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-paramo-muted">
                          Clientes que más compran
                        </h3>
                        <ul className="space-y-1 text-sm">
                          {seguimiento.top_clientes.map((c) => (
                            <li key={c.cliente} className="flex justify-between gap-2">
                              <span className="truncate text-paramo-fg">{c.cliente}</span>
                              <span className="font-bold text-paramo-fg">
                                {formatMoneyShort(c.valor)}
                                {seguimiento.valor
                                  ? ` · ${Math.round((c.valor / seguimiento.valor) * 100)}%`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-[10px] bg-paramo-surface-2 p-3 text-sm text-paramo-muted">
                      {actual.estado === "desarrollo" || actual.estado === "lanzamiento"
                        ? "Aún sin ventas: es un producto nuevo."
                        : "Sin ventas en los meses cargados. Revisa que el nombre en el Excel coincida con el del catálogo."}
                    </p>
                  )}
                  <div>
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-paramo-muted">
                      Prospectos interesados ({opinionesData?.interesados.length ?? 0})
                    </h3>
                    {opinionesData?.interesados.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {opinionesData.interesados.map((i) => (
                          <Link
                            key={i.id}
                            href={`/prospectos?abrir=${i.id}`}
                            className="rounded-full border border-paramo-line px-3 py-1 text-xs font-bold text-paramo-teal-ink hover:bg-paramo-surface-2"
                          >
                            {i.empresa}
                            {i.etapa ? ` · ${i.etapa}` : ""}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-paramo-muted">
                        Se marca como producto de interés desde la ficha de cada prospecto.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-paramo-muted">
                      Retroalimentación y degustaciones
                    </h3>
                    {opinionesData?.opiniones.length ? (
                      <ul className="space-y-2">
                        {opinionesData.opiniones.map((o) => (
                          <li key={o.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 text-sm">
                            <span className="text-xs text-paramo-muted">
                              {fechaCorta(o.fecha)}
                              <br />
                              {o.tipo}
                            </span>
                            <span className="text-paramo-fg">
                              <b>{o.cliente}</b>{" "}
                              {o.calif ? (
                                <span className="text-paramo-olive" aria-label={`${o.calif} de 5`}>
                                  {"★".repeat(o.calif)}
                                </span>
                              ) : null}
                              <br />
                              {o.texto}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-paramo-muted">
                        Aún no hay retroalimentación. Se registra desde la ficha de cada prospecto.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              <fieldset disabled={!editable || cargando} className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 w-full text-xs font-bold uppercase tracking-wide text-paramo-muted">
                  Ficha del producto
                </legend>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="pr-nombre" className={labelClass}>
                    Nombre comercial *
                  </label>
                  <input
                    id="pr-nombre"
                    required
                    maxLength={200}
                    value={form.nombre}
                    onChange={(e) => setCampo("nombre", e.target.value)}
                    placeholder="Ej. Mango Chips 20g"
                    className={fieldClass}
                    autoFocus={esNuevo}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-pvp" className={labelClass}>
                    PVP · precio venta público (COP) *
                  </label>
                  <input
                    id="pr-pvp"
                    type="number"
                    min={0}
                    step={100}
                    inputMode="numeric"
                    required
                    value={form.precio_publico}
                    onChange={(e) => setCampo("precio_publico", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-linea" className={labelClass}>
                    Línea
                  </label>
                  <select
                    id="pr-linea"
                    value={form.linea}
                    onChange={(e) => setCampo("linea", e.target.value)}
                    className={fieldClass}
                  >
                    {LINEAS_PRODUCTO.map((l) => (
                      <option key={l.codigo} value={l.codigo}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-estado" className={labelClass}>
                    Estado
                  </label>
                  <select
                    id="pr-estado"
                    value={form.estado}
                    onChange={(e) => setCampo("estado", e.target.value)}
                    className={fieldClass}
                  >
                    {ESTADOS_PRODUCTO.map((e) => (
                      <option key={e.codigo} value={e.codigo}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-pres" className={labelClass}>
                    Presentación
                  </label>
                  <input
                    id="pr-pres"
                    maxLength={80}
                    value={form.presentacion}
                    onChange={(e) => setCampo("presentacion", e.target.value)}
                    placeholder="Ej. 20 g"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-sku" className={labelClass}>
                    SKU
                  </label>
                  <input
                    id="pr-sku"
                    maxLength={80}
                    value={form.sku}
                    onChange={(e) => setCampo("sku", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="pr-codigo" className={labelClass}>
                    Código
                  </label>
                  <input
                    id="pr-codigo"
                    maxLength={80}
                    value={form.codigo}
                    onChange={(e) => setCampo("codigo", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="pr-desc" className={labelClass}>
                    Descripción / notas
                  </label>
                  <textarea
                    id="pr-desc"
                    rows={3}
                    maxLength={2000}
                    value={form.descripcion}
                    onChange={(e) => setCampo("descripcion", e.target.value)}
                    className={`${fieldClass} min-h-[88px] py-2`}
                  />
                </div>
              </fieldset>

              <section aria-labelledby="pr-precios-t" className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="pr-precios-t"
                    className="mr-auto text-xs font-bold uppercase tracking-wide text-paramo-muted"
                  >
                    Precios por tipo de cliente{esNuevo ? " *" : ""}
                  </h3>
                  {editable ? (
                    <button
                      type="button"
                      onClick={llenarConListaGeneral}
                      disabled={cargando}
                      className={`${btnSmall} border border-paramo-line text-paramo-fg hover:bg-paramo-surface-2`}
                    >
                      Llenar con la lista general
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-paramo-muted">
                  Para cada tipo de cliente define un <b>% de descuento sobre el PVP</b>{" "}
                  o un <b>precio fijo</b>.{" "}
                  {esNuevo ? "Es obligatorio al crear el producto. " : ""}
                  {esSupervisor
                    ? "Como Supervisor, tus precios quedan en firme de inmediato."
                    : "Los precios que definas quedan pendientes hasta que el Supervisor los apruebe; mientras tanto se cotiza con la lista general."}
                </p>
                <div className="overflow-x-auto rounded-[10px] border border-paramo-line">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                        <th className="px-3 py-2">Tipo de cliente</th>
                        <th className="px-3 py-2">Definir como</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="px-3 py-2 text-right">Precio resultante</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-paramo-line">
                        <td className="px-3 py-2">Consumidor final</td>
                        <td className="px-3 py-2 text-xs text-paramo-muted">PVP</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-right font-bold text-paramo-fg">
                          {pvp ? formatCOP(pvp) : "—"}
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                      {tiposPrecio.map((t) => {
                        const f = form.precios[t.codigo] ?? { modo: "pct", v: "" };
                        const raw = f.v.trim();
                        const def =
                          raw === ""
                            ? null
                            : normalizarPrecio({ modo: f.modo, v: Number(raw) });
                        const resultado =
                          precioDesdeDefinicion(pvp, def) ||
                          precioListaGeneral(pvp, t.descuento_pct);
                        const pend = actual?.precios_pendientes[t.codigo];
                        const firme = actual
                          ? normalizarPrecio(actual.precios[t.codigo])
                          : null;
                        const pendNorm = pend
                          ? normalizarPrecio({ modo: pend.modo, v: pend.v })
                          : null;
                        return (
                          <tr
                            key={t.codigo}
                            className="border-b border-paramo-line last:border-b-0"
                          >
                            <td className="px-3 py-2">{t.nombre}</td>
                            <td className="w-44 px-3 py-2">
                              <select
                                aria-label={`Cómo se define el precio para ${t.nombre}`}
                                value={f.modo}
                                disabled={!editable || cargando}
                                onChange={(e) =>
                                  setPrecio(t.codigo, {
                                    modo: e.target.value as ModoPrecio,
                                  })
                                }
                                className={fieldClass}
                              >
                                <option value="pct">% sobre PVP</option>
                                <option value="precio">Precio fijo</option>
                              </select>
                            </td>
                            <td className="w-32 px-3 py-2">
                              <input
                                aria-label={`Valor para ${t.nombre}`}
                                type="number"
                                min={0}
                                max={f.modo === "pct" ? PCT_MAX_PRODUCTO : undefined}
                                step="any"
                                inputMode="decimal"
                                disabled={!editable || cargando}
                                value={f.v}
                                placeholder={
                                  f.modo === "pct" ? String(t.descuento_pct) : "$"
                                }
                                onChange={(e) =>
                                  setPrecio(t.codigo, { v: e.target.value })
                                }
                                className={fieldClass}
                              />
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-bold ${
                                def ? "text-paramo-fg" : "text-paramo-muted"
                              }`}
                            >
                              {pvp ? formatCOP(resultado) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {pend ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-paramo-warn px-2 py-0.5 text-xs font-bold text-paramo-warn">
                                    Por aprobar: {textoPrecio(pendNorm)}
                                  </span>
                                  {canApprove ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={cargando}
                                        onClick={() =>
                                          resolverPrecio(t.codigo, "aprobar")
                                        }
                                        className={`${btnSmall} bg-paramo-teal text-paramo-brand-ink hover:brightness-110`}
                                      >
                                        Aprobar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={cargando}
                                        onClick={() =>
                                          resolverPrecio(t.codigo, "rechazar")
                                        }
                                        className={`${btnSmall} border border-paramo-line text-paramo-fg hover:bg-paramo-surface-2`}
                                      >
                                        Rechazar
                                      </button>
                                    </>
                                  ) : null}
                                  <span className="w-full text-xs text-paramo-muted">
                                    {pend.por_nombre}
                                  </span>
                                </div>
                              ) : firme ? (
                                <span className="rounded-full border border-paramo-good px-2 py-0.5 text-xs font-bold text-paramo-good">
                                  En firme
                                </span>
                              ) : esNuevo ? (
                                <span className="text-xs text-paramo-muted">
                                  Obligatorio
                                </span>
                              ) : (
                                <span className="text-xs text-paramo-muted">
                                  Lista general ({t.descuento_pct}%)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {error ? (
                <p className="text-sm text-paramo-bad" role="alert">
                  {error}
                </p>
              ) : null}
              {aviso ? (
                <p className="text-sm text-paramo-good" role="status">
                  {aviso}
                </p>
              ) : null}
              {!editable ? (
                <p className="text-sm text-paramo-muted">Solo lectura.</p>
              ) : null}

              {editable ? (
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-paramo-line pt-4">
                  {actual ? (
                    confirmaBorrar ? (
                      <>
                        <span className="mr-auto text-sm text-paramo-muted">
                          ¿Eliminar del catálogo? Las ventas cargadas no se borran.
                        </span>
                        <button
                          type="button"
                          onClick={eliminar}
                          disabled={cargando}
                          className={`${btnGhost} border-paramo-bad text-paramo-bad`}
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmaBorrar(false)}
                          className={btnGhost}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmaBorrar(true)}
                        disabled={cargando}
                        className={`${btnGhost} mr-auto text-paramo-bad`}
                      >
                        Eliminar
                      </button>
                    )
                  ) : null}
                  {!confirmaBorrar ? (
                    <button type="submit" disabled={cargando} className={btnPrimary}>
                      {cargando
                        ? "Guardando…"
                        : esNuevo
                          ? "Crear producto"
                          : "Guardar cambios"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
