"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ROL_LABEL, ROLES, type Rol } from "@/config/roles";

export type UsuarioListItem = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
};

type UsuariosPanelProps = {
  initialUsuarios: UsuarioListItem[];
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UsuariosPanel({ initialUsuarios }: UsuariosPanelProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("comercial");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password, rol }),
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(body?.error ?? "No se pudo crear el usuario.");
        return;
      }

      setNombre("");
      setEmail("");
      setPassword("");
      setRol("comercial");
      setOk("Usuario creado. Ya puede iniciar sesión.");
      router.refresh();
    } catch {
      setError("No se pudo crear el usuario. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] border border-paramo-line bg-paramo-surface p-5">
        <h2 className="mb-4 font-paramo-display text-lg font-bold text-paramo-fg">
          Crear usuario
        </h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          <div className="space-y-1 sm:col-span-1">
            <label
              htmlFor="usuario-nombre"
              className="text-[11.5px] font-bold text-paramo-muted"
            >
              Nombre
            </label>
            <input
              id="usuario-nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="usuario-email"
              className="text-[11.5px] font-bold text-paramo-muted"
            >
              Correo
            </label>
            <input
              id="usuario-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="usuario-password"
              className="text-[11.5px] font-bold text-paramo-muted"
            >
              Contraseña
            </label>
            <input
              id="usuario-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
            />
            <p className="text-xs text-paramo-muted">Mínimo 8 caracteres.</p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="usuario-rol"
              className="text-[11.5px] font-bold text-paramo-muted"
            >
              Rol
            </label>
            <select
              id="usuario-rol"
              name="rol"
              required
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-sm text-paramo-bad sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-sm text-paramo-good sm:col-span-2" role="status">
              {ok}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-paramo-brand px-5 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[10px] border border-paramo-line bg-paramo-surface p-5">
        <h2 className="mb-4 font-paramo-display text-lg font-bold text-paramo-fg">
          Usuarios
        </h2>
        {initialUsuarios.length === 0 ? (
          <p className="text-sm text-paramo-muted">
            Aún no hay usuarios en profiles.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-paramo-line text-[11.5px] font-bold uppercase tracking-wide text-paramo-muted">
                  <th className="px-2 py-2 font-bold">Nombre</th>
                  <th className="px-2 py-2 font-bold">Correo</th>
                  <th className="px-2 py-2 font-bold">Rol</th>
                  <th className="px-2 py-2 font-bold">Estado</th>
                  <th className="px-2 py-2 font-bold">Creado</th>
                </tr>
              </thead>
              <tbody>
                {initialUsuarios.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-paramo-line last:border-b-0"
                  >
                    <td className="px-2 py-3 font-medium text-paramo-fg">
                      {u.nombre || "—"}
                    </td>
                    <td className="px-2 py-3 text-paramo-fg">{u.email}</td>
                    <td className="px-2 py-3 text-paramo-fg">
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={
                          u.activo ? "text-paramo-good" : "text-paramo-muted"
                        }
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-paramo-muted">
                      {formatFecha(u.creado_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
