import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kasolife.app",
  appName: "KasoLife",
  // Pointe vers l'export statique Next.js (npm run build:mobile)
  webDir: "out",

  // ── Mode développement (optionnel) ────────────────────────────────────────
  // Pour itérer rapidement sans rebuild Capacitor à chaque changement,
  // décommenter et pointer vers le serveur `next dev` accessible sur le
  // réseau local (ex: http://192.168.1.50:3000). Recompiler avec `npx cap sync`
  // après avoir commenté à nouveau pour la build de production.
  // server: {
  //   url: "http://192.168.1.50:3000",
  //   cleartext: true,
  // },

  android: {
    // Permet le SPA fallback : toute route inconnue (ex: ouverte via une
    // notification push deep-link) charge index.html, qui hydrate ensuite
    // côté client via useDynamicSegment().
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0E1F1B", // ink (fond principal — voir tailwind.config.ts)
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK", // texte clair sur fond sombre (style 'DARK' = contenu sombre désactivé → icônes claires)
      backgroundColor: "#0E1F1B",
    },
  },
};

export default config;
