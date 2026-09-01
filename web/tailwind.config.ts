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
          DEFAULT: "#65A1E6",   // fond principal bleu ciel
          surface: "#7CB3F0",   // cartes, panneaux (bleu ciel plus clair)
          raised: "#5B95DD",    // éléments surélevés, hover (bleu ciel plus foncé)
          line: "#4A7FB8",      // bordures discrètes (bleu foncé)
        },
        paper: {
          DEFAULT: "#FBF8F3",   // fond clair (formulaires, admin)
          surface: "#F2EDE3",
        },
        gold: {
          DEFAULT: "#20B2AA",   // teal foncé principal — CTA, unlock
          dim: "#188A7E",
          bright: "#48D1CC",
        },
        coral: {
          DEFAULT: "#FFFFFF",   // blanc — texte actif, live, alertes (contraste sur bleu)
          dim: "#F0F4F8",       // gris clair pour variantes
        },
        sage: {
          DEFAULT: "#3B5998",   // bleu foncé pour texte atténué
          muted: "#2D5A8C",     // bleu encore plus foncé pour texte très atténué
        },
        cream: "#FFFFFF",       // blanc — texte principal sur fond bleu ciel
        emerald: {
          DEFAULT: "#2DD4BF",   // teal — succès, revenus, abonnement actif (contraste sur bleu)
          bright: "#5DEDE8",    // teal clair pour accents
        },
        brick: "#EF4444",       // rouge vif pour erreurs/danger (contraste sur bleu)
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
