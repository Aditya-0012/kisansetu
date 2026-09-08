/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Earth + Technology palette (spec section 4) — deep agricultural
        // green as the primary brand color, fresh green for growth/positive
        // states, warm cream as the base ground, charcoal for text, with a
        // small set of restrained semantic accents. No neon, no rainbow.
        brand: {
          50: "#EEF5EF",
          100: "#D6E7D9",
          200: "#AECFB4",
          300: "#82B48C",
          400: "#579A66",
          500: "#3A7F4A",
          600: "#2C6539",
          700: "#1F4D36", // primary — deep agricultural green
          800: "#173B2A",
          900: "#102A1E",
        },
        fresh: {
          400: "#7CC576",
          500: "#5CAE54", // fresh green — growth, positive states
          600: "#489042",
        },
        cream: {
          50: "#FEFDFB",
          100: "#FAF7F0", // base ground
          200: "#F2ECDD",
        },
        charcoal: {
          600: "#4A4A45",
          700: "#3A3A35",
          800: "#2A2A26",
          900: "#1C1C19", // primary text
        },
        earth: {
          clay: "#B4744A",
          wheat: "#D9B36C",
          soil: "#6B5842",
        },
        state: {
          success: "#2C8A4B",
          warning: "#C97F1E",
          danger: "#C0432F",
          info: "#2E6E9E",
        },
      },
      fontFamily: {
        sans: ["Manrope", "Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Manrope", "system-ui", "sans-serif"],
        devanagari: ["Noto Sans Devanagari", "Manrope", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,28,25,0.04), 0 4px 16px rgba(28,28,25,0.06)",
        "card-hover": "0 2px 4px rgba(28,28,25,0.06), 0 12px 32px rgba(28,28,25,0.10)",
        panel: "0 8px 40px rgba(28,28,25,0.10)",
      },
      spacing: {
        4.5: "1.125rem",
        18: "4.5rem",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "count-up": "count-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
};
