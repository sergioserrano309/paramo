import type { SupabaseClient } from "@supabase/supabase-js";
import { todayBogota } from "@/lib/format";

/**
 * Agrega una entrada al historial del prospecto (as-is `actividad`). Es trazabilidad, no
 * negocio: si falla no debe tumbar la operación principal. Con `tocarContacto` también
 * marca hoy como último contacto (alimenta la alerta «stale» del funnel y del Dashboard).
 */
export async function registrarActividad(
  service: SupabaseClient,
  args: {
    prospectoId: string;
    tipo: string;
    texto: string;
    usuarioId: string;
    tocarContacto?: boolean;
  },
): Promise<void> {
  try {
    await service.from("prospecto_actividad").insert({
      prospecto_id: args.prospectoId,
      tipo: args.tipo.slice(0, 40),
      texto: args.texto.slice(0, 1_000),
      usuario_id: args.usuarioId,
    });
    if (args.tocarContacto) {
      await service
        .from("prospectos")
        .update({ ultimo_contacto: todayBogota(), actualizado_por: args.usuarioId })
        .eq("id", args.prospectoId);
    }
  } catch {
    // Intencional: ver comentario de la función.
  }
}
