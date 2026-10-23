import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { registrarBitacora } from "@/lib/bitacora";
import { hasSupabaseServiceConfig } from "@/lib/env";
import { clientKey, readJsonBody } from "@/lib/http";
import { formatCOP } from "@/lib/precios";
import { isAuthContext, requireApiPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase-server";
import { pkey } from "@/lib/texto";
import { MAX_FILAS_CARGA } from "@/lib/ventas-excel";
import { mesCorto } from "@/lib/ventas-periodo";

// 10.000 filas × ~200 bytes; por debajo del tope de 4,5 MB de una función en Vercel.
const MAX_BODY_BYTES = 3_500_000;
const DENIED = "No se pudieron guardar las ventas.";

const texto = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max));

const filaSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((f) => {
      const d = new Date(`${f}T12:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
    }),
  cliente: z.string().trim().min(1).max(200),
  canal: texto(120),
  ciudad: texto(120),
  producto: z.string().trim().min(1).max(200),
  unidades: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  valor: z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000),
});

const bodySchema = z.object({
  archivo: z.string().trim().min(1).max(200),
  agregar_productos: z.boolean().default(false),
  filas: z.array(filaSchema).min(1).max(MAX_FILAS_CARGA),
});

/**
 * Carga de ventas desde la plantilla Excel (as-is saveUpload). Reemplaza completos los
 * meses que trae el archivo. Solo `editar` (comercial), como el as-is.
 */
export async function POST(request: Request) {
  const auth = await requireApiPermission("editar");
  if (!isAuthContext(auth)) return auth;

  if (!hasSupabaseServiceConfig()) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 503 });
  }

  if (!rateLimit(`ventas-cargar:${auth.userId}:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: DENIED }, { status: 429 });
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: DENIED }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: DENIED }, { status: 422 });
  }
  const { archivo, filas, agregar_productos } = parsed.data;

  // La clave de cruce con el catálogo la calcula el servidor, no el navegador.
  const filasDb = filas.map((f) => ({ ...f, producto_clave: pkey(f.producto) }));
  const service = createServiceClient();

  const { data: insertadas, error } = await service.rpc("cargar_ventas", {
    p_filas: filasDb,
    p_archivo: archivo,
    p_usuario: auth.userId,
  });
  if (error) {
    return NextResponse.json({ error: DENIED }, { status: 500 });
  }

  const meses = [...new Set(filas.map((f) => f.fecha.slice(0, 7)))].sort();
  const total = filas.reduce((a, f) => a + f.valor, 0);

  const creados: string[] = [];
  if (agregar_productos) {
    const { data: existentes } = await service.from("productos").select("nombre");
    const conocidos = new Set((existentes ?? []).map((p) => pkey(p.nombre)));
    const nuevos = new Map<string, string>();
    for (const f of filasDb) {
      if (!conocidos.has(f.producto_clave) && !nuevos.has(f.producto_clave)) {
        nuevos.set(f.producto_clave, f.producto);
      }
    }
    for (const nombre of nuevos.values()) {
      // Como el as-is: línea «Otra», sin PVP (se completa en Productos). Si el nombre ya
      // existe con otra ortografía, el índice único lo rechaza y se omite.
      const { error: e } = await service.from("productos").insert({
        nombre,
        linea: "otra",
        estado: "activo",
        precio_publico: 0,
        creado_por: auth.userId,
        actualizado_por: auth.userId,
      });
      if (!e) creados.push(nombre);
    }
    if (creados.length) {
      await registrarBitacora(
        service,
        auth,
        "Producto creado",
        `${creados.length} desde cargue de ventas: ${creados.join(", ")}`,
      );
    }
  }

  await registrarBitacora(
    service,
    auth,
    "Ventas cargadas",
    `${archivo}: ${filas.length.toLocaleString("es-CO")} filas, ${meses.map(mesCorto).join(", ")}, ${formatCOP(total)}`,
  );

  return NextResponse.json({
    ok: true,
    filas: typeof insertadas === "number" ? insertadas : filas.length,
    meses,
    productos_creados: creados.length,
  });
}
