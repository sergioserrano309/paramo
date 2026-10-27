import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Por defecto las páginas dinámicas no se guardan en el navegador (0 s): cada vez que se
    // vuelve a un módulo se repite todo el viaje al servidor. Con 20 s, ir y volver entre
    // módulos es inmediato; `router.refresh()` tras una escritura limpia ese caché.
    staleTimes: { dynamic: 20 },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
