import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
