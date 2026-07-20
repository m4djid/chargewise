import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--amp-bg-page)",
        subtle: "var(--amp-bg-subtle)",
        hover: "var(--amp-bg-hover)",
        active: "var(--amp-bg-active)",
        surface: "var(--amp-surface)",
        "border-default": "var(--amp-border-default)",
        "border-strong": "var(--amp-border-strong)",
        primary: "var(--amp-text-primary)",
        secondary: "var(--amp-text-secondary)",
        tertiary: "var(--amp-text-tertiary)",
        "on-accent": "var(--amp-text-on-accent)",
        accent: {
          DEFAULT: "var(--amp-accent)",
          hover: "var(--amp-accent-hover)",
          active: "var(--amp-accent-active)",
          subtle: "var(--amp-accent-subtle)",
          text: "var(--amp-accent-text)",
        },
        status: {
          available: "var(--amp-status-available)",
          "available-bg": "var(--amp-status-available-bg)",
          inuse: "var(--amp-status-inuse)",
          "inuse-bg": "var(--amp-status-inuse-bg)",
          danger: "var(--amp-status-outoforder)",
          "danger-bg": "var(--amp-status-outoforder-bg)",
          unknown: "var(--amp-status-unknown)",
          "unknown-bg": "var(--amp-status-unknown-bg)",
        },
      },
      // Aliases so the canonical Ampere class names `border-default` /
      // `border-strong` resolve (color keys alone would require the
      // double-barrelled `border-border-default`).
      borderColor: {
        default: "var(--amp-border-default)",
        strong: "var(--amp-border-strong)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        sm: "var(--amp-shadow-sm)",
        md: "var(--amp-shadow-md)",
        lg: "var(--amp-shadow-lg)",
        focus: "var(--amp-focus-ring)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      transitionTimingFunction: {
        amp: "cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [],
};
export default config;
