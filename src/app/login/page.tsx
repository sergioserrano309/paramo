import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paramo-bg px-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-paramo-line bg-paramo-surface p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-paramo-teal-ink">
            Good Chips by Páramo
          </p>
          <h1 className="font-paramo-display text-2xl font-bold text-paramo-brand">
            Ingresar
          </h1>
          <p className="text-sm text-paramo-muted">
            Usa el correo y contraseña de tu usuario en Supabase Auth.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-paramo-muted">Cargando…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
