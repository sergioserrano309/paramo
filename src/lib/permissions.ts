import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  MODULO_ROLES,
  ROL_ACCIONES,
  type Accion,
  type Modulo,
} from "@/config/permissions";
import type { Rol } from "@/config/roles";
import { getAuthContext, type AuthContext } from "@/lib/auth";
import { AUTH_UNAUTHORIZED_BODY } from "@/lib/auth-errors";

/** Equivalente a `can(a)` del as-is. */
export function can(rol: Rol, accion: Accion): boolean {
  return ROL_ACCIONES[rol].includes(accion);
}

/** Equivalente a filtrar VIEWS con `only`. */
export function canAccessModule(rol: Rol, modulo: Modulo): boolean {
  return MODULO_ROLES[modulo].includes(rol);
}

export function assertCan(rol: Rol, accion: Accion): void {
  if (!can(rol, accion)) {
    throw new PermissionDeniedError(accion);
  }
}

export class PermissionDeniedError extends Error {
  readonly accion: Accion;

  constructor(accion: Accion) {
    super("No autorizado");
    this.name = "PermissionDeniedError";
    this.accion = accion;
  }
}

/** Layouts/páginas del CRM: sin permiso de módulo → dashboard. */
export async function requireModuleAccess(modulo: Modulo): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!canAccessModule(ctx.profile.rol, modulo)) {
    redirect("/dashboard");
  }
  return ctx;
}

/**
 * Para API routes: sesión + acción.
 * Devuelve contexto o una Response 401/403 lista para retornar.
 */
export async function requireApiPermission(
  accion: Accion,
): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 401 });
  }
  if (!can(ctx.profile.rol, accion)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  return ctx;
}

/**
 * Sesión + al menos una de las acciones (as-is canCreateP: editar || asignar).
 */
export async function requireApiAnyPermission(
  acciones: readonly Accion[],
): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 401 });
  }
  if (!acciones.some((accion) => can(ctx.profile.rol, accion))) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  return ctx;
}

/** Sesión + acceso al módulo (lectura de listados). */
export async function requireApiModuleAccess(
  modulo: Modulo,
): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 401 });
  }
  if (!canAccessModule(ctx.profile.rol, modulo)) {
    return NextResponse.json(AUTH_UNAUTHORIZED_BODY, { status: 403 });
  }
  return ctx;
}

/** Equivalente a canCreateP del as-is. */
export function canCreateProspecto(rol: Rol): boolean {
  return can(rol, "editar") || can(rol, "asignar");
}

export function isAuthContext(
  value: AuthContext | NextResponse,
): value is AuthContext {
  return !(value instanceof NextResponse);
}
