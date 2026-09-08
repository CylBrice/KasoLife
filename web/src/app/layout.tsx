import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Space_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider } from "@/i18n/locale-context";
import { ThemeProvider } from "@/contexts/theme-context";

// Applique la classe .dark AVANT l'hydratation React pour éviter un flash
// du mauvais thème au chargement (lit la préférence sauvegardée, sinon la
// préférence système).
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('kasolife_theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

// Alternative gratuite (Google Fonts) au look d'Aeonik — utilisée pour le
// wordmark de marque. Remplaçable par Aeonik si une licence est acquise.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KasoLife — Soutenez vos créateurs préférés",
  description:
    "KasoLife est la plateforme qui connecte les créateurs francophones d'Afrique subsaharienne — fitness, musique, cuisine, art, mode, gaming et plus — à leur communauté.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KasoLife",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png",   sizes: "16x16",   type: "image/png" },
      { url: "/favicon-32x32.png",   sizes: "32x32",   type: "image/png" },
      { url: "/favicon-48x48.png",   sizes: "48x48",   type: "image/png" },
      { url: "/icons/icon-192.png",  sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png",  sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-apple-touch.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-apple-touch.png", sizes: "120x120", type: "image/png" },
      { url: "/icons/icon-apple-touch.png", sizes: "167x167", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: "#0B2545",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* iOS splash screens — évite l'écran blanc au lancement en mode standalone */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1242x2208.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-828x1792.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1080x2340.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/splash/splash-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1536x2048.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-1668x2388.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" href="/splash/splash-2048x2732.png" />
      </head>
      <body
        className={`${inter.variable} ${fraunces.variable} ${spaceMono.variable} ${jakarta.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>{children}</AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
