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
          DEFAULT: "#0E1F1B",   // fond principal (mode sombre par défaut)
          surface: "#16302A",  // cartes, panneaux
          raised: "#1E3D35",   // éléments surélevés, hover
          line: "#2A4A41",     // bordures discrètes
        },
        paper: {
          DEFAULT: "#FBF8F3",  // fond clair (formulaires, admin)
          surface: "#F2EDE3",
        },
        gold: {
          DEFAULT: "#D946A6",  // rose sombre principal — CTA, unlock
          dim: "#A91777",
          bright: "#E879C2",
        },
        coral: {
          DEFAULT: "#65A1E6",  // bleu ciel — actif, live, alertes
          dim: "#4A7FB8",
        },
        sage: {
          DEFAULT: "#9CB5AC",  // texte atténué
          muted: "#6E8A80",
        },
        cream: "#F4F1EA",      // texte principal sur fond sombre
        emerald: {
          DEFAULT: "#65A1E6",  // bleu ciel — succès, revenus, abonnement actif
          bright: "#8BC0F0",
        },
        brick: "#C84B31",      // erreurs/danger
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
