"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  CAJAS,
  DESC_MAX,
  DESC_TOPE,
  ESTADOS_EDITABLES,
  ESTADOS_FINALES,
  IVA_DEFAULT,
  PAGOS,
  PAGO_DEFAULT,
  VALIDEZ_DEFAULT_DIAS,
  estadoCotizacion,
  type EstadoCotizacion,
} from "@/config/cotizaciones";
import { calcularTotales } from "@/lib/cotizaciones-calculo";
import { descargarCotizacionPdf } from "@/lib/cotizacion-pdf";
import { formatMoneyShort, todayBogota } from "@/lib/format";
import { formatCOP, precioParaTipo } from "@/lib/precios";
import type {
  ContactoCliente,
  CotizacionListItem,
  ProspectoCotizable,
} from "@/lib/types/cotizacion";
import type { ProductoListItem, TipoClientePrecio } from "@/lib/types/producto";

type Props = {
  initialCotizaciones: CotizacionListItem[];
  prospectos: ProspectoCotizable[];
  productos: ProductoListItem[];
  tiposCliente: TipoClientePrecio[];
  cargaFallida: boolean;
  userId: string;
  abrirInicial: string;
  nuevaInicial: boolean;
  prospectoInicial: string;
  puedeEditarTodo: boolean;
  puedeAprobar: boolean;
  esSupervisor: boolean;
};

type LineaForm = { producto_id: string; caja: string; cant: string };

type FormState = {
  prospecto_id: string;
  tipo_cliente_codigo: string;
  fecha: string;
  validez_dias: string;
  pago: string;
  entrega: string;
  notas: string;
  desc_pct: string;
  iva_pct: string;
  items: LineaForm[];
};

type Filtro = "activas" | "aprobar" | "cerradas" | "todas";

const TONO_PUNTO: Record<string, string> = {
  muted: "bg-paramo-muted",
  warn: "bg-paramo-warn",
  bad: "bg-paramo-bad",
  teal: "bg-paramo-teal",
  brand: "bg-paramo-brand",
  leaf: "bg-paramo-leaf",
  rasp: "bg-paramo-rasp",
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "text-[11.5px] font-bold text-paramo-muted";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnTeal =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-teal px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-paramo-line px-4 text-sm font-bold text-paramo-fg hover:bg-paramo-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

function EstadoPill({ estado }: { estado: string }) {
  const e = estadoCotizacion(estado);
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
  if (!iso) return "—";
  const d = iso.length > 10 ? new Date(iso) : new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CotizacionesPanel({
  initialCotizaciones,
  prospectos,
  productos,
  tiposCliente,
  cargaFallida,
  userId,
  abrirInicial,
  nuevaInicial,
  prospectoInicial,
  puedeEditarTodo,
  puedeAprobar,
  esSupervisor,
}: Props) {
  const titleId = useId();
  const [cotizaciones, setCotizaciones] = useState(initialCotizaciones);
  const [filtro, setFiltro] = useState<Filtro>("activas");
  // null = cerrado; "nueva" = alta; uuid = cotización abierta.
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => formVacio(null));
  const [ap, setAp] = useState({ desc: "", comentario: "" });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);

  useEffect(() => {
    setCotizaciones(initialCotizaciones);
  }, [initialCotizaciones]);

  useEffect(() => {
    if (!abierta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierta]);

  const prospectoPorId = useMemo(
    () => new Map(prospectos.map((p) => [p.id, p])),
    [prospectos],
  );
  const productoPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );
  const tipoPorCodigo = useMemo(
    () => new Map(tiposCliente.map((t) => [t.codigo, t])),
    [tiposCliente],
  );

  const actual =
    abierta && abierta !== "nueva"
      ? (cotizaciones.find((c) => c.id === abierta) ?? null)
      : null;
  const esNueva = abierta === "nueva";

  /** As-is canEditQ: `editar`, o responsable del prospecto, o creador si no hay prospecto. */
  function puedeEditar(c: CotizacionListItem): boolean {
    if (puedeEditarTodo) return true;
    const p = c.prospecto_id ? prospectoPorId.get(c.prospecto_id) : undefined;
    return p ? p.responsable_id === userId : c.creado_por === userId;
  }

  /** As-is canCreateQ. */
  const puedeCrear =
    puedeEditarTodo ||
    prospectos.some((p) => p.activo && p.responsable_id === userId);

  // Llegada con `?abrir=ID` o `?nueva=1&prospecto=ID` (ficha del prospecto, bitácora…).
  useEffect(() => {
    if (abrirInicial) {
      const c = initialCotizaciones.find((x) => x.id === abrirInicial);
      if (c) abrir(c);
    } else if (nuevaInicial && puedeCrear) {
      const p = prospectoInicial ? prospectoPorId.get(prospectoInicial) : undefined;
      setForm(formVacio(p ?? null));
      setAbierta("nueva");
    }
    // Solo al montar: después el usuario controla el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editable =
    esNueva || (actual ? puedeEditar(actual) && ESTADOS_EDITABLES.includes(actual.estado) : false);
  const puedeActuar = actual ? puedeEditar(actual) : false;

  function formVacio(prospecto: ProspectoCotizable | null): FormState {
    return {
      prospecto_id: prospecto?.id ?? "",
      tipo_cliente_codigo: prospecto?.tipo_cliente_codigo ?? "tienda",
      fecha: todayBogota(),
      validez_dias: String(VALIDEZ_DEFAULT_DIAS),
      pago: PAGO_DEFAULT,
      entrega: prospecto?.ciudad ?? "",
      notas: "",
      desc_pct: "0",
      iva_pct: String(IVA_DEFAULT),
      items: [{ producto_id: "", caja: "", cant: "1" }],
    };
  }

  function formDesde(c: CotizacionListItem): FormState {
    return {
      prospecto_id: c.prospecto_id ?? "",
      tipo_cliente_codigo: c.tipo_cliente_codigo ?? "tienda",
      fecha: c.fecha,
      validez_dias: String(c.validez_dias),
      pago: c.pago,
      entrega: c.entrega,
      notas: c.notas,
      desc_pct: String(c.desc_pct),
      iva_pct: String(c.iva_pct),
      items: c.items.length
        ? c.items.map((i) => ({
            producto_id: i.producto_id ?? "",
            caja: i.caja,
            cant: String(i.cant),
          }))
        : [{ producto_id: "", caja: "", cant: "1" }],
    };
  }

  function cerrar() {
    setAbierta(null);
    setError(null);
    setConfirmaBorrar(false);
  }

  function abrirNueva() {
    setError(null);
    setAviso(null);
    setConfirmaBorrar(false);
    setForm(formVacio(null));
    setAbierta("nueva");
  }

  function abrir(c: CotizacionListItem) {
    setError(null);
    setAviso(null);
    setConfirmaBorrar(false);
    setForm(formDesde(c));
    setAp({ desc: String(c.desc_solicitado ?? c.desc_pct), comentario: "" });
    setAbierta(c.id);
  }

  function setCampo<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function elegirProspecto(id: string) {
    const p = prospectoPorId.get(id);
    setForm((prev) => ({
      ...prev,
      prospecto_id: id,
      tipo_cliente_codigo: p?.tipo_cliente_codigo ?? prev.tipo_cliente_codigo,
      entrega: p && !prev.entrega ? p.ciudad : prev.entrega,
    }));
  }

  function setLinea(i: number, parche: Partial<LineaForm>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((l, k) => (k === i ? { ...l, ...parche } : l)),
    }));
  }

  function guardarEnLista(c: CotizacionListItem) {
    setCotizaciones((prev) => {
      const existe = prev.some((x) => x.id === c.id);
      const next = existe ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
      return next.sort((a, b) => b.numero.localeCompare(a.numero));
    });
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
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !json) {
      throw new Error(json?.error ?? "No se pudo completar la acción.");
    }
    return json;
  }

  // Precios en vivo: mismo cálculo que hace el servidor al guardar.
  const tipoForm = tipoPorCodigo.get(form.tipo_cliente_codigo);
  const lineasCalculadas = form.items.map((l) => {
    const prod = productoPorId.get(l.producto_id);
    const precio = prod ? precioParaTipo(prod, tipoForm) : 0;
    return { precio, cant: Number(l.cant) || 0 };
  });
  const totales = calcularTotales(
    lineasCalculadas,
    Number(form.desc_pct) || 0,
    Number(form.iva_pct) || 0,
  );

  async function guardar(modo: "borrador" | "final") {
    if (!editable) return;
    setError(null);
    setAviso(null);
    if (!form.prospecto_id) {
      setError("Elige el cliente de la cotización.");
      return;
    }
    setCargando(true);
    try {
      const payload = {
        modo,
        prospecto_id: form.prospecto_id,
        tipo_cliente_codigo: form.tipo_cliente_codigo,
        fecha: form.fecha,
        validez_dias: Number(form.validez_dias) || VALIDEZ_DEFAULT_DIAS,
        pago: form.pago,
        entrega: form.entrega,
        notas: form.notas,
        desc_pct: Number(form.desc_pct) || 0,
        iva_pct: Number(form.iva_pct) || 0,
        items: form.items
          .filter((l) => l.producto_id)
          .map((l) => ({
            producto_id: l.producto_id,
            caja: l.caja,
            cant: Number(l.cant) || 0,
          })),
      };
      const res = esNueva
        ? await llamar<{ cotizacion: CotizacionListItem }>("/api/cotizaciones", "POST", payload)
        : await llamar<{ cotizacion: CotizacionListItem }>(
            `/api/cotizaciones/${actual?.id}`,
            "PATCH",
            payload,
          );
      guardarEnLista(res.cotizacion);
      setForm(formDesde(res.cotizacion));
      setAp({
        desc: String(res.cotizacion.desc_solicitado ?? res.cotizacion.desc_pct),
        comentario: "",
      });
      setAbierta(res.cotizacion.id);
      setAviso(
        res.cotizacion.estado === "pendiente"
          ? "Solicitud enviada al Supervisor."
          : res.cotizacion.estado === "final"
            ? "Versión final lista."
            : "Borrador guardado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la cotización.");
    } finally {
      setCargando(false);
    }
  }

  async function transicion(
    accion: "aprobar" | "rechazar" | "enviar" | "aceptar" | "no_aceptada" | "nueva_version",
    mensaje: string,
  ) {
    if (!actual) return;
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const res = await llamar<{ cotizacion: CotizacionListItem }>(
        `/api/cotizaciones/${actual.id}/estado`,
        "POST",
        {
          accion,
          descuento: accion === "aprobar" ? Number(ap.desc) || 0 : undefined,
          comentario: ap.comentario,
        },
      );
      guardarEnLista(res.cotizacion);
      setForm(formDesde(res.cotizacion));
      setAviso(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la cotización.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminar() {
    if (!actual) return;
    setError(null);
    setCargando(true);
    try {
      await llamar<{ ok: true }>(`/api/cotizaciones/${actual.id}`, "DELETE");
      setCotizaciones((prev) => prev.filter((c) => c.id !== actual.id));
      cerrar();
      setAviso("Cotización eliminada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la cotización.");
    } finally {
      setCargando(false);
    }
  }

  async function descargarPdf() {
    if (!actual) return;
    setError(null);
    setCargando(true);
    try {
      // El servidor deja constancia en bitácora y entrega los datos de contacto del cliente.
      const res = await fetch(`/api/cotizaciones/${actual.id}/descarga`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as {
        contacto?: ContactoCliente | null;
      } | null;
      if (!res.ok) throw new Error("descarga");
      await descargarCotizacionPdf({
        cot: actual,
        contacto: json?.contacto ?? null,
        tipoClienteNombre:
          tipoPorCodigo.get(actual.tipo_cliente_codigo ?? "")?.nombre ?? "",
      });
      setAviso("PDF descargado.");
    } catch {
      setError("No se pudo generar el PDF.");
    } finally {
      setCargando(false);
    }
  }

  // ---- Listado y KPI (as-is vCotizaciones) ----
  const pendientes = cotizaciones.filter((c) => c.estado === "pendiente");
  const mesActual = todayBogota().slice(0, 7);
  const delMes = cotizaciones.filter(
    (c) => c.fecha.startsWith(mesActual) && ESTADOS_FINALES.includes(c.estado),
  );
  const cerradas = cotizaciones.filter((c) => c.estado === "aceptada" || c.estado === "no_aceptada");
  const aceptadas = cerradas.filter((c) => c.estado === "aceptada");

  const lista = cotizaciones.filter((c) => {
    if (filtro === "activas") return c.estado !== "aceptada" && c.estado !== "no_aceptada";
    if (filtro === "aprobar") return c.estado === "pendiente";
    if (filtro === "cerradas") return c.estado === "aceptada" || c.estado === "no_aceptada";
    return true;
  });

  const clientes = prospectos.filter(
    (p) =>
      p.id === form.prospecto_id ||
      (p.activo &&
        p.etapa_codigo !== "perdido" &&
        (puedeEditarTodo || p.responsable_id === userId)),
  );
  const productosLinea = productos.filter((p) => p.estado !== "descontinuado");
  const descNum = Number(form.desc_pct) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <header className="space-y-1">
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
            Cotizaciones
          </h1>
          <p className="text-sm text-paramo-muted">
            Precios según tipo de cliente · descuentos de más del {DESC_MAX}% los aprueba
            el Supervisor
          </p>
        </header>
        {puedeCrear ? (
          <button type="button" onClick={abrirNueva} className={btnPrimary}>
            Nueva cotización
          </button>
        ) : null}
      </div>

      {aviso && !abierta ? (
        <p className="text-sm text-paramo-good" role="status">
          {aviso}
        </p>
      ) : null}
      {cargaFallida ? (
        <p className="text-sm text-paramo-bad" role="alert">
          No se pudieron cargar todos los datos. Revisa que las migraciones de productos y
          cotizaciones estén aplicadas en Supabase.
        </p>
      ) : null}

      {puedeAprobar && pendientes.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-paramo-warn bg-paramo-surface p-3 text-sm">
          <span className="mr-auto text-paramo-fg">
            <b>
              {pendientes.length}{" "}
              {pendientes.length === 1 ? "cotización espera" : "cotizaciones esperan"} tu
              aprobación
            </b>{" "}
            por descuento mayor al {DESC_MAX}%.
          </span>
          <button type="button" onClick={() => setFiltro("aprobar")} className={btnPrimary}>
            Revisar
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta="Cotizado este mes"
          valor={formatMoneyShort(delMes.reduce((a, c) => a + c.total, 0))}
          pie={`${delMes.length} cotizaciones finales`}
        />
        <Kpi
          etiqueta="En seguimiento"
          valor={String(cotizaciones.filter((c) => c.estado === "enviada").length)}
          pie="enviadas, esperando respuesta del cliente"
        />
        <Kpi
          etiqueta="Tasa de aceptación"
          valor={cerradas.length ? `${Math.round((aceptadas.length / cerradas.length) * 100)}%` : "—"}
          pie={`${aceptadas.length} aceptadas de ${cerradas.length} cerradas`}
        />
        <Kpi
          etiqueta="Descuentos por aprobar"
          valor={String(pendientes.length)}
          pie={`superan el ${DESC_MAX}% y requieren al Supervisor`}
          alerta={pendientes.length > 0}
        />
      </div>

      <div
        role="group"
        aria-label="Filtro"
        className="inline-flex flex-wrap gap-1 rounded-full border border-paramo-line bg-paramo-surface p-1"
      >
        {(
          [
            ["activas", "Activas"],
            ["aprobar", "Por aprobar"],
            ["cerradas", "Cerradas"],
            ["todas", "Todas"],
          ] as Array<[Filtro, string]>
        ).map(([k, n]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filtro === k}
            onClick={() => setFiltro(k)}
            className={`min-h-9 rounded-full px-3 text-xs font-bold ${
              filtro === k
                ? "bg-paramo-brand text-paramo-brand-ink"
                : "text-paramo-muted hover:bg-paramo-surface-2"
            }`}
          >
            {n}
            {k === "aprobar" && pendientes.length ? ` (${pendientes.length})` : ""}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-8 text-center">
          <h3 className="font-paramo-display text-lg font-bold text-paramo-fg">
            {cotizaciones.length
              ? "No hay cotizaciones en este filtro"
              : "Aún no hay cotizaciones"}
          </h3>
          <p className="mt-1 text-sm text-paramo-muted">
            {puedeCrear
              ? "Crea una con el botón Nueva cotización."
              : "Cuando el vendedor cotice, aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-paramo-line bg-paramo-surface">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Desc.</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-paramo-line last:border-b-0 hover:bg-paramo-surface-2"
                  onClick={() => abrir(c)}
                >
                  <td className="whitespace-nowrap px-3 py-3 font-bold text-paramo-fg">
                    <button
                      type="button"
                      className="text-left focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir(c);
                      }}
                    >
                      {c.numero}
                      {c.version > 1 ? (
                        <span className="ml-1 text-xs font-normal text-paramo-muted">
                          v{c.version}
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-paramo-fg">
                      {prospectoPorId.get(c.prospecto_id ?? "")?.empresa ?? c.cliente_nombre}
                    </div>
                    <div className="text-xs text-paramo-muted">
                      {tipoPorCodigo.get(c.tipo_cliente_codigo ?? "")?.nombre ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-paramo-muted">{fechaCorta(c.fecha)}</td>
                  <td className="px-3 py-3">
                    <EstadoPill estado={c.estado} />
                  </td>
                  <td className="px-3 py-3 text-right">{c.desc_pct ? `${c.desc_pct}%` : "—"}</td>
                  <td className="px-3 py-3 text-right font-bold text-paramo-fg">
                    {formatCOP(c.total)}
                  </td>
                  <td className="px-3 py-3 text-xs text-paramo-muted">{c.creado_por_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abierta ? (
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
            className="flex h-full w-full max-w-4xl flex-col border-l border-paramo-line bg-paramo-surface shadow-lg"
          >
            <div className="flex items-start gap-3 border-b border-paramo-line px-4 py-3">
              <div className="mr-auto min-w-0">
                <h2
                  id={titleId}
                  className="font-paramo-display text-xl font-bold text-paramo-fg"
                >
                  {esNueva ? "Nueva cotización" : (actual?.numero ?? "Cotización")}
                  {actual && actual.version ? (
                    <span className="ml-2 text-sm font-normal text-paramo-muted">
                      v{actual.version}
                    </span>
                  ) : null}
                </h2>
                {actual ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paramo-muted">
                    <EstadoPill estado={actual.estado} />
                    creada por {actual.creado_por_nombre}
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
              className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
              onSubmit={(e: FormEvent) => e.preventDefault()}
              noValidate
            >
              {actual?.estado === "pendiente" ? (
                puedeAprobar ? (
                  <section className="space-y-3 rounded-[10px] border border-paramo-warn p-3">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-paramo-muted">
                      Aprobación de descuento
                    </h3>
                    <p className="text-sm text-paramo-fg">
                      {actual.creado_por_nombre} solicita{" "}
                      <b>{actual.desc_solicitado ?? actual.desc_pct}%</b> de descuento
                      (máximo sin aprobación: {DESC_MAX}%). Total con ese descuento:{" "}
                      <b>{formatCOP(actual.total)}</b>.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <div className="w-44 space-y-1">
                        <label htmlFor="ap-desc" className={labelClass}>
                          Descuento aprobado (%)
                        </label>
                        <input
                          id="ap-desc"
                          type="number"
                          min={0}
                          max={actual.desc_solicitado ?? actual.desc_pct}
                          step={0.5}
                          value={ap.desc}
                          onChange={(e) => setAp((s) => ({ ...s, desc: e.target.value }))}
                          className={fieldClass}
                        />
                      </div>
                      <div className="min-w-[220px] flex-1 space-y-1">
                        <label htmlFor="ap-com" className={labelClass}>
                          Comentario
                        </label>
                        <input
                          id="ap-com"
                          maxLength={400}
                          value={ap.comentario}
                          onChange={(e) =>
                            setAp((s) => ({ ...s, comentario: e.target.value }))
                          }
                          placeholder="Opcional"
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={cargando}
                        onClick={() => transicion("rechazar", "Descuento rechazado.")}
                        className={`${btnGhost} text-paramo-bad`}
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        disabled={cargando}
                        onClick={() =>
                          transicion("aprobar", "Descuento aprobado: versión final lista.")
                        }
                        className={btnTeal}
                      >
                        Aprobar y generar versión final
                      </button>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-[10px] border border-paramo-warn p-3 text-sm text-paramo-fg">
                    Esperando aprobación del Supervisor para{" "}
                    {actual.desc_solicitado ?? actual.desc_pct}% de descuento. Si editas la
                    cotización, la solicitud se retira.
                  </p>
                )
              ) : null}

              {actual?.aprobacion ? (
                <p className="rounded-[10px] bg-paramo-teal-soft p-3 text-sm text-paramo-teal-ink">
                  Descuento de {actual.aprobacion.desc}% aprobado por{" "}
                  {actual.aprobacion.por_nombre} el {fechaHora(actual.aprobacion.en)}
                  {actual.aprobacion.solicitado !== actual.aprobacion.desc
                    ? ` (se solicitó ${actual.aprobacion.solicitado}%)`
                    : ""}
                  {actual.aprobacion.comentario ? ` · ${actual.aprobacion.comentario}` : ""}
                </p>
              ) : null}
              {actual?.estado === "rechazada" && actual.rechazo ? (
                <p className="rounded-[10px] border border-paramo-bad p-3 text-sm text-paramo-fg">
                  El Supervisor rechazó {actual.rechazo.solicitado}% de descuento el{" "}
                  {fechaHora(actual.rechazo.en)}
                  {actual.rechazo.comentario ? `: «${actual.rechazo.comentario}»` : ""}. Ajusta
                  el descuento y genera de nuevo la versión final.
                </p>
              ) : null}

              <fieldset
                disabled={!editable || cargando}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                  <label htmlFor="q-cliente" className={labelClass}>
                    Cliente *
                  </label>
                  <select
                    id="q-cliente"
                    value={form.prospecto_id}
                    onChange={(e) => elegirProspecto(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Elige el cliente…</option>
                    {clientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.empresa}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-tipo" className={labelClass}>
                    Tipo de cliente (define los precios)
                  </label>
                  <select
                    id="q-tipo"
                    value={form.tipo_cliente_codigo}
                    onChange={(e) => setCampo("tipo_cliente_codigo", e.target.value)}
                    className={fieldClass}
                  >
                    {tiposCliente.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-fecha" className={labelClass}>
                    Fecha
                  </label>
                  <input
                    id="q-fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setCampo("fecha", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-validez" className={labelClass}>
                    Validez (días)
                  </label>
                  <input
                    id="q-validez"
                    type="number"
                    min={1}
                    max={365}
                    value={form.validez_dias}
                    onChange={(e) => setCampo("validez_dias", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-pago" className={labelClass}>
                    Forma de pago
                  </label>
                  <select
                    id="q-pago"
                    value={form.pago}
                    onChange={(e) => setCampo("pago", e.target.value)}
                    className={fieldClass}
                  >
                    {PAGOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-entrega" className={labelClass}>
                    Lugar de entrega
                  </label>
                  <input
                    id="q-entrega"
                    maxLength={200}
                    value={form.entrega}
                    onChange={(e) => setCampo("entrega", e.target.value)}
                    placeholder="Ciudad o dirección"
                    className={fieldClass}
                  />
                </div>
              </fieldset>

              <section aria-labelledby="q-prod-t" className="space-y-2">
                <h3
                  id="q-prod-t"
                  className="text-xs font-bold uppercase tracking-wide text-paramo-muted"
                >
                  Productos
                </h3>
                <div className="overflow-x-auto rounded-[10px] border border-paramo-line">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Tipo de caja</th>
                        <th className="px-3 py-2">Cantidad</th>
                        <th className="px-3 py-2 text-right">Precio unit.</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((l, i) => {
                        const c = lineasCalculadas[i];
                        return (
                          <tr key={i} className="border-b border-paramo-line last:border-b-0">
                            <td className="min-w-[200px] px-3 py-2">
                              <select
                                aria-label="Producto"
                                disabled={!editable || cargando}
                                value={l.producto_id}
                                onChange={(e) => setLinea(i, { producto_id: e.target.value })}
                                className={fieldClass}
                              >
                                <option value="">Elige un producto…</option>
                                {productosLinea
                                  .slice()
                                  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nombre}
                                    </option>
                                  ))}
                              </select>
                            </td>
                            <td className="w-32 px-3 py-2">
                              <select
                                aria-label="Tipo de caja"
                                disabled={!editable || cargando}
                                value={l.caja}
                                onChange={(e) => setLinea(i, { caja: e.target.value })}
                                className={fieldClass}
                              >
                                <option value="">Elegir…</option>
                                {CAJAS.map((x) => (
                                  <option key={x} value={x}>
                                    {x}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="w-28 px-3 py-2">
                              <input
                                aria-label="Cantidad"
                                type="number"
                                min={0}
                                step={1}
                                disabled={!editable || cargando}
                                value={l.cant}
                                onChange={(e) => setLinea(i, { cant: e.target.value })}
                                className={fieldClass}
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              {c.precio ? formatCOP(c.precio) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-paramo-fg">
                              {formatCOP(c.cant * c.precio)}
                            </td>
                            <td className="w-12 px-3 py-2">
                              {editable && form.items.length > 1 ? (
                                <button
                                  type="button"
                                  aria-label="Quitar línea"
                                  onClick={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      items: prev.items.filter((_, k) => k !== i),
                                    }))
                                  }
                                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-paramo-muted hover:bg-paramo-surface-2"
                                >
                                  ✕
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        items: [...prev.items, { producto_id: "", caja: "", cant: "1" }],
                      }))
                    }
                    className={btnGhost}
                  >
                    Agregar producto
                  </button>
                ) : null}
              </section>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <fieldset disabled={!editable || cargando} className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <div className="w-36 space-y-1">
                      <label htmlFor="q-desc" className={labelClass}>
                        Descuento %
                      </label>
                      <input
                        id="q-desc"
                        type="number"
                        min={0}
                        max={DESC_TOPE}
                        step={0.5}
                        value={form.desc_pct}
                        onChange={(e) => setCampo("desc_pct", e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div className="w-44 space-y-1">
                      <label htmlFor="q-iva" className={labelClass}>
                        IVA
                      </label>
                      <select
                        id="q-iva"
                        value={form.iva_pct}
                        onChange={(e) => setCampo("iva_pct", e.target.value)}
                        className={fieldClass}
                      >
                        <option value="19">19%</option>
                        <option value="0">0% · exportación</option>
                      </select>
                    </div>
                  </div>
                  {editable && descNum > DESC_MAX ? (
                    <p
                      className={`rounded-[10px] border p-3 text-sm ${
                        esSupervisor
                          ? "border-paramo-teal bg-paramo-teal-soft text-paramo-teal-ink"
                          : "border-paramo-warn text-paramo-fg"
                      }`}
                    >
                      {esSupervisor
                        ? `Como Supervisor, tu descuento de ${descNum}% queda aprobado al generar la versión final.`
                        : `Un descuento de ${descNum}% supera el ${DESC_MAX}% autorizado. Puedes sugerirlo: al generar la versión final se envía al Supervisor para su aprobación.`}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <label htmlFor="q-notas" className={labelClass}>
                      Observaciones para el cliente
                    </label>
                    <textarea
                      id="q-notas"
                      rows={3}
                      maxLength={2000}
                      value={form.notas}
                      onChange={(e) => setCampo("notas", e.target.value)}
                      placeholder="Ej. Precios no incluyen transporte fuera de Bogotá"
                      className={`${fieldClass} min-h-[88px] py-2`}
                    />
                  </div>
                </fieldset>
                <dl className="space-y-1 self-start rounded-[10px] border border-paramo-line p-3 text-sm">
                  <Fila k="Subtotal" v={formatCOP(totales.sub)} />
                  <Fila k={`Descuento (${totales.d}%)`} v={`− ${formatCOP(totales.dv)}`} />
                  <Fila k="Base" v={formatCOP(totales.base)} />
                  <Fila k={`IVA (${Number(form.iva_pct) || 0}%)`} v={formatCOP(totales.iva)} />
                  <div className="mt-2 flex items-baseline justify-between border-t border-paramo-line pt-2 text-base">
                    <dt className="font-bold text-paramo-fg">Total</dt>
                    <dd className="font-bold text-paramo-brand">{formatCOP(totales.tot)}</dd>
                  </div>
                </dl>
              </div>

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
              {!esNueva && actual && !puedeActuar && !puedeAprobar ? (
                <p className="text-sm text-paramo-muted">Solo lectura.</p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-paramo-line pt-4">
                {actual && actual.estado === "borrador" && puedeActuar ? (
                  confirmaBorrar ? (
                    <>
                      <span className="mr-auto text-sm text-paramo-muted">
                        ¿Eliminar esta cotización?
                      </span>
                      <button
                        type="button"
                        onClick={eliminar}
                        disabled={cargando}
                        className={`${btnGhost} text-paramo-bad`}
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
                  <>
                    {actual ? (
                      <button
                        type="button"
                        onClick={descargarPdf}
                        disabled={cargando}
                        className={btnGhost}
                      >
                        PDF{ESTADOS_FINALES.includes(actual.estado) ? "" : " (borrador)"}
                      </button>
                    ) : null}
                    {editable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => guardar("borrador")}
                          disabled={cargando}
                          className={btnGhost}
                        >
                          Guardar borrador
                        </button>
                        <button
                          type="button"
                          onClick={() => guardar("final")}
                          disabled={cargando}
                          className={btnPrimary}
                        >
                          {descNum > DESC_MAX && !esSupervisor
                            ? "Solicitar aprobación"
                            : "Generar versión final"}
                        </button>
                      </>
                    ) : null}
                    {actual && puedeActuar && actual.estado === "final" ? (
                      <button
                        type="button"
                        disabled={cargando}
                        onClick={() => transicion("enviar", "Cotización marcada como enviada.")}
                        className={btnTeal}
                      >
                        Marcar como enviada
                      </button>
                    ) : null}
                    {actual && puedeActuar && actual.estado === "enviada" ? (
                      <>
                        <button
                          type="button"
                          disabled={cargando}
                          onClick={() =>
                            transicion("no_aceptada", "Cotización marcada como no aceptada.")
                          }
                          className={btnGhost}
                        >
                          No aceptada
                        </button>
                        <button
                          type="button"
                          disabled={cargando}
                          onClick={() =>
                            transicion("aceptar", "Cotización aceptada. El cliente pasó a Ganado.")
                          }
                          className={btnTeal}
                        >
                          Aceptada por el cliente
                        </button>
                      </>
                    ) : null}
                    {actual &&
                    puedeActuar &&
                    (["enviada", "aceptada", "no_aceptada"] as EstadoCotizacion[]).includes(
                      actual.estado,
                    ) ? (
                      <button
                        type="button"
                        disabled={cargando}
                        onClick={() => transicion("nueva_version", "Nueva versión en preparación.")}
                        className={btnGhost}
                      >
                        Crear nueva versión
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  etiqueta,
  valor,
  pie,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  pie: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-paramo-surface p-4 ${
        alerta ? "border-paramo-warn" : "border-paramo-line"
      }`}
    >
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
        {etiqueta}
      </div>
      <div className="mt-1 font-paramo-display text-2xl font-bold text-paramo-fg">{valor}</div>
      <div className="text-xs text-paramo-muted">{pie}</div>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-paramo-muted">{k}</dt>
      <dd className="font-bold text-paramo-fg">{v}</dd>
    </div>
  );
}
