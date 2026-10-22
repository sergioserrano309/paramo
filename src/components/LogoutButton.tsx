"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="min-h-11 w-full rounded-lg border border-paramo-line bg-paramo-surface px-2.5 py-2 text-left text-sm font-semibold text-paramo-muted hover:bg-paramo-surface-2 hover:text-paramo-fg disabled:opacity-60"
    >
      {loading ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
