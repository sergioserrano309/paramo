import { NextResponse } from "next/server";
import { MODULOS, ROL_ACCIONES } from "@/config/permissions";
import { getAuthContext } from "@/lib/auth";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";
import { canAccessModule } from "@/lib/permissions";

/**
 * Perfil + capacidades del usuario autenticado.
 * Útil para la UI; la autorización real sigue viviendo en cada API.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 401 });
  }

  const { profile } = ctx;
  const acciones = [...ROL_ACCIONES[profile.rol]];
  const modulos = MODULOS.filter((m) => canAccessModule(profile.rol, m));

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email,
      nombre: profile.nombre,
      rol: profile.rol,
    },
    acciones,
    modulos,
  });
}
