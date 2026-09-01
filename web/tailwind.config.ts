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
          DEFAULT: "#E8A33D",  // accent principal — CTA, unlock
          dim: "#C98A2E",
          bright: "#F5BE63",
        },
        coral: {
          DEFAULT: "#F0664C",  // accent secondaire — actif, live, alertes douces
          dim: "#D6543B",
        },
        sage: {
          DEFAULT: "#9CB5AC",  // texte atténué
          muted: "#6E8A80",
        },
        cream: "#F4F1EA",      // texte principal sur fond sombre
        emerald: {
          DEFAULT: "#1E7A5F",  // succès, revenus, abonnement actif
          bright: "#2BAE85",
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
