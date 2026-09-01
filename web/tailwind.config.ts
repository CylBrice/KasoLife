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
          DEFAULT: "#3B82F6",  // bleu principal — CTA, unlock
          dim: "#1E40AF",
          bright: "#60A5FA",
        },
        coral: {
          DEFAULT: "#FF6B6B",  // coral vif — actif, live, alertes
          dim: "#FF5252",
        },
        sage: {
          DEFAULT: "#9CB5AC",  // texte atténué
          muted: "#6E8A80",
        },
        cream: "#F4F1EA",      // texte principal sur fond sombre
        emerald: {
          DEFAULT: "#FF6B6B",  // coral — succès, revenus, abonnement actif
          bright: "#FF8282",
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
