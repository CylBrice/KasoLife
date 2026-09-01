import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#E3F2FD",   // fond principal bleu très clair
          surface: "#FFFFFF",   // cartes, panneaux (blanc — ressort sur le fond clair)
          raised: "#D2E9FB",    // éléments surélevés, hover (légèrement plus soutenu)
          line: "#90CAF9",      // bordures discrètes (bleu moyen, visibles sur fond clair)
        },
        paper: {
          DEFAULT: "#FBF8F3",   // fond clair (formulaires, admin)
          surface: "#F2EDE3",
        },
        gold: {
          DEFAULT: "#8B1538",   // bordeaux principal — CTA, unlock (contraste fort sur fond clair)
          dim: "#6B0E2A",
          bright: "#B83F52",
        },
        coral: {
          DEFAULT: "#1565C0",   // bleu soutenu — texte actif, live, alertes (contraste sur fond clair)
          dim: "#0D47A1",
        },
        sage: {
          DEFAULT: "#4A6FA5",   // bleu-gris moyen pour texte atténué
          muted: "#7C93B3",     // bleu-gris clair pour texte très atténué
        },
        cream: "#0B2545",       // bleu marine foncé — texte principal sur fond clair
        emerald: {
          DEFAULT: "#0F9488",   // teal foncé — succès, revenus, abonnement actif (contraste sur fond clair)
          bright: "#14B8A6",    // teal moyen pour accents
        },
        brick: "#DC2626",       // rouge — erreurs/danger (contraste sur fond clair)
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      backgroundImage: {
        "lattice": "url('/lattice.svg')",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
