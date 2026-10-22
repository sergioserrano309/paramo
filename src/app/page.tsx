import { redirect } from "next/navigation";

/** Entrada de la app operativa: el CRM empieza en ingreso. */
export default function HomePage() {
  redirect("/login");
}
