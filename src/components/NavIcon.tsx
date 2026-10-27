import type { Modulo } from "@/config/permissions";

type NavIconProps = {
  name: Modulo;
};

/**
 * Trazos del rail as-is (ICON en pre-arquitectura).
 * Usuarios no está en ese rail; el icono de una persona usa el mismo trazo.
 */
const PATHS: Record<Modulo, React.ReactNode> = {
  dashboard: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  supervision: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.2-5.5 7-5.5s6.2 2 7 5.5" />
    </>
  ),
  prospectos: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.5 3.5 5.2" />
    </>
  ),
  funnel: <path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" />,
  compromisos: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M8 14l2 2 4-4" />
    </>
  ),
  cotizaciones: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  productos: (
    <>
      <path d="M6 3h12l1 4H5z" />
      <path d="M5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M10 11h4" />
    </>
  ),
  ventas: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

export function NavIcon({ name }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
