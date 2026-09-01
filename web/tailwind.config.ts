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
        // Tokens pilotés par variables CSS (globals.css) — basculent
        // automatiquement entre clair/sombre via la classe .dark sur <html>,
        // sans qu'aucun composant utilisant bg-ink/text-cream/etc. n'ait à changer.
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          surface: "rgb(var(--c-ink-surface) / <alpha-value>)",
          raised: "rgb(var(--c-ink-raised) / <alpha-value>)",
          line: "rgb(var(--c-ink-line) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "#FBF8F3",   // fond clair (formulaires, admin) — volontairement fixe
          surface: "#F2EDE3",
        },
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          dim: "rgb(var(--c-gold-dim) / <alpha-value>)",
          bright: "rgb(var(--c-gold-bright) / <alpha-value>)",
        },
        coral: {
          DEFAULT: "rgb(var(--c-coral) / <alpha-value>)",
          dim: "rgb(var(--c-coral-dim) / <alpha-value>)",
        },
        sage: {
          DEFAULT: "rgb(var(--c-sage) / <alpha-value>)",
          muted: "rgb(var(--c-sage-muted) / <alpha-value>)",
        },
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        emerald: {
          DEFAULT: "rgb(var(--c-emerald) / <alpha-value>)",
          bright: "rgb(var(--c-emerald-bright) / <alpha-value>)",
        },
        brick: "rgb(var(--c-brick) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
        brand: ["var(--font-jakarta)", "sans-serif"],
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
