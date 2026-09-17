import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera archivos HTML/CSS/JS estáticos en la carpeta `out/` al hacer build,
  // en vez de requerir un servidor Node corriendo Next.js.
  output: "export",

  // Necesario para hosting estático: cada ruta queda como carpeta/index.html
  // (ej. /dashboard -> out/dashboard/index.html) en vez de /dashboard.html
  trailingSlash: true,

  // La optimización automática de imágenes de Next.js requiere un servidor,
  // así que se desactiva (solo aplica si usas el componente <Image>).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
