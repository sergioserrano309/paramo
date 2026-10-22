"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(body?.error ?? "No se pudo iniciar sesión.");
        return;
      }

      const next = searchParams.get("next");
      const dest =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-1">
        <label htmlFor="email" className="text-[11.5px] font-bold text-paramo-muted">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-[11.5px] font-bold text-paramo-muted">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-3 text-paramo-fg focus:border-paramo-teal focus:outline-none focus:ring-2 focus:ring-paramo-teal-soft"
        />
      </div>

      {error ? (
        <p className="text-sm text-paramo-bad" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-paramo-brand px-4 text-sm font-bold text-paramo-brand-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
