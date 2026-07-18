import type { Config } from "tailwindcss";

/**
 * AgentOS design system — warm living-world brand (see /BRAND.md).
 * Dusk blue-slate surfaces (never black, never purple), warm paper ink, a coral
 * signature with gold reward and department hues. Soft, sunlit, hand-made feel.
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
        // Warm living-world brand — dusk (blue-slate, never black/purple). See /BRAND.md.
        canvas: "#171c2e",
        surface: {
          DEFAULT: "#20273f",
          raised: "#262e49",
          overlay: "#2c3556",
          inset: "#141a2b",
        },
        line: {
          DEFAULT: "rgba(214,220,240,0.10)",
          strong: "rgba(214,220,240,0.18)",
        },
        content: {
          DEFAULT: "#F3EFE6",
          muted: "#B7B1A4",
          subtle: "#877F6E",
        },
        // "iris" kept as the accent token name, but it is now the brand CORAL ramp.
        iris: {
          50: "#fdf1ec",
          100: "#fbe0d5",
          200: "#f6c3ac",
          300: "#f2a184",
          400: "#ef8a68",
          500: "#ED7150",
          600: "#d85e3f",
          700: "#b64a30",
          800: "#8f3b28",
          900: "#6d3022",
          DEFAULT: "#ED7150",
        },
        // "aqua" secondary → department blue.
        aqua: {
          400: "#7FB0E0",
          500: "#5A97D6",
          600: "#4A83BE",
          DEFAULT: "#5A97D6",
        },
        gold: { DEFAULT: "#F0BE4D", soft: "rgba(240,190,77,0.14)" },
        positive: { DEFAULT: "#4E9E63", soft: "rgba(78,158,99,0.14)" },
        warning: { DEFAULT: "#E6AE3C", soft: "rgba(230,174,60,0.14)" },
        danger: { DEFAULT: "#E8705C", soft: "rgba(232,112,92,0.14)" },
        info: { DEFAULT: "#5A97D6", soft: "rgba(90,151,214,0.14)" },
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
        card: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 8px 30px -12px rgba(0,0,0,0.5)",
        raised: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 20px 50px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(237,113,80,0.35), 0 0 40px -8px rgba(237,113,80,0.55)",
        "glow-aqua": "0 0 0 1px rgba(90,151,214,0.35), 0 0 40px -8px rgba(90,151,214,0.5)",
        focus: "0 0 0 2px rgba(23,28,46,1), 0 0 0 4px rgba(237,113,80,0.6)",
      },
      backgroundImage: {
        "iris-gradient": "linear-gradient(135deg, #F0BE4D 0%, #ED7150 92%)",
        "iris-soft": "linear-gradient(135deg, rgba(237,113,80,0.16), rgba(240,190,77,0.10))",
        "grid-faint":
          "linear-gradient(rgba(214,220,240,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(214,220,240,0.03) 1px, transparent 1px)",
        "radial-iris":
          "radial-gradient(60% 50% at 50% 0%, rgba(240,190,77,0.16), transparent 70%)",
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
          "0%": { boxShadow: "0 0 0 0 rgba(237,113,80,0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgba(237,113,80,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(237,113,80,0)" },
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
