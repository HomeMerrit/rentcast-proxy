import type { Config } from "tailwindcss";

/**
 * AgentOS design system.
 * A deep "space canvas" dark theme with an iris/violet signature, glass surfaces,
 * soft glows and a refined type scale. Tuned for a premium, OS-grade product feel.
 */
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
        canvas: "#070810",
        surface: {
          DEFAULT: "#0c0e18",
          raised: "#11131f",
          overlay: "#161927",
          inset: "#090a12",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.07)",
          strong: "rgba(255,255,255,0.13)",
        },
        content: {
          DEFAULT: "#eef1fa",
          muted: "#98a1ba",
          subtle: "#5f6884",
        },
        iris: {
          50: "#f1f0ff",
          100: "#e5e2ff",
          200: "#cdc7ff",
          300: "#ab9fff",
          400: "#8b78ff",
          500: "#7257ff",
          600: "#6039f5",
          700: "#4f2bd1",
          800: "#4126a9",
          900: "#372587",
          DEFAULT: "#7257ff",
        },
        aqua: {
          400: "#38e0f7",
          500: "#18cbe6",
          600: "#0ba6c4",
          DEFAULT: "#22d3ee",
        },
        positive: { DEFAULT: "#34d399", soft: "rgba(52,211,153,0.12)" },
        warning: { DEFAULT: "#fbbf24", soft: "rgba(251,191,36,0.12)" },
        danger: { DEFAULT: "#fb7185", soft: "rgba(251,113,133,0.12)" },
        info: { DEFAULT: "#60a5fa", soft: "rgba(96,165,250,0.12)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
        raised: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 20px 50px -20px rgba(0,0,0,0.75)",
        glow: "0 0 0 1px rgba(114,87,255,0.35), 0 0 40px -8px rgba(114,87,255,0.55)",
        "glow-aqua": "0 0 0 1px rgba(34,211,238,0.35), 0 0 40px -8px rgba(34,211,238,0.5)",
        focus: "0 0 0 2px rgba(7,8,16,1), 0 0 0 4px rgba(114,87,255,0.6)",
      },
      backgroundImage: {
        "iris-gradient": "linear-gradient(135deg, #7257ff 0%, #a855f7 55%, #22d3ee 130%)",
        "iris-soft": "linear-gradient(135deg, rgba(114,87,255,0.16), rgba(34,211,238,0.10))",
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "radial-iris":
          "radial-gradient(60% 50% at 50% 0%, rgba(114,87,255,0.18), transparent 70%)",
      },
      backgroundSize: {
        grid: "44px 44px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(114,87,255,0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgba(114,87,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(114,87,255,0)" },
        },
        "gradient-pan": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
        shimmer: "shimmer 1.8s infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
      },
    },
  },
  plugins: [],
};
export default config;
