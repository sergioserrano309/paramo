import Link from "next/link";

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
            Setup inicial: la autenticación con Supabase Auth se conectará aquí.
            Mientras tanto puedes explorar el shell de módulos.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-paramo-brand px-4 text-sm font-bold text-paramo-brand-ink hover:brightness-110"
        >
          Entrar al CRM (preview)
        </Link>
        <p className="text-xs text-paramo-muted">
          Configura las variables de{" "}
          <code className="text-paramo-fg">.env.example</code> en{" "}
          <code className="text-paramo-fg">.env.local</code> antes de conectar Auth.
        </p>
      </div>
    </div>
  );
}
