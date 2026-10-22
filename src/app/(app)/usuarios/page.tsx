import {
  UsuariosPanel,
  type UsuarioListItem,
} from "@/components/UsuariosPanel";
import { isRol } from "@/config/roles";
import { requireModuleAccess } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase-server";

export default async function UsuariosPage() {
  await requireModuleAccess("usuarios");

  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select("id, email, nombre, rol, activo, creado_en")
    .order("nombre", { ascending: true })
    .limit(200);

  const usuarios: UsuarioListItem[] = [];
  if (!error && data) {
    for (const row of data) {
      if (!isRol(row.rol)) continue;
      usuarios.push({
        id: row.id,
        email: row.email,
        nombre: row.nombre,
        rol: row.rol,
        activo: row.activo,
        creado_en: row.creado_en,
      });
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
          Usuarios
        </h1>
        <p className="text-sm text-paramo-muted">
          Crear y listar usuarios del CRM. Solo supervisor.
        </p>
      </header>
      <UsuariosPanel initialUsuarios={usuarios} />
    </section>
  );
}
