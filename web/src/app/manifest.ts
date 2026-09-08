import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KasoLife",
    short_name: "KasoLife",
    description: "Soutenez vos créateurs préférés",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B2545",
    theme_color: "#0B2545",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-72.png",   sizes: "72x72",     type: "image/png" },
      { src: "/icons/icon-96.png",   sizes: "96x96",     type: "image/png" },
      { src: "/icons/icon-128.png",  sizes: "128x128",   type: "image/png" },
      { src: "/icons/icon-144.png",  sizes: "144x144",   type: "image/png" },
      { src: "/icons/icon-152.png",  sizes: "152x152",   type: "image/png" },
      { src: "/icons/icon-192.png",          sizes: "192x192",   type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192",   type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-384.png",          sizes: "384x384",   type: "image/png" },
      { src: "/icons/icon-512.png",          sizes: "512x512",   type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512",   type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-1024.png",         sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
