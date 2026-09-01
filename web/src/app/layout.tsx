import type { Metadata } from "next";
import { Inter, Fraunces, Space_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { LocaleProvider } from "@/i18n/locale-context";

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
    <html lang="fr" className="dark">
      <body
        className={`${inter.variable} ${fraunces.variable} ${spaceMono.variable} ${jakarta.variable} font-sans antialiased`}
      >
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
