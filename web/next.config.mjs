/** @type {import('next').NextConfig} */

// BUILD_TARGET=mobile → export statique pour Capacitor (Android/iOS)
// Sans cette variable → build Next.js normal (déploiement web SSR)
const isMobileBuild = process.env.BUILD_TARGET === "mobile";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  ...(isMobileBuild ? { output: "export" } : {}),
  images: {
    // En export statique, l'API d'optimisation d'image (qui nécessite un
    // serveur Next) n'est pas disponible — on désactive l'optimisation.
    unoptimized: isMobileBuild,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
