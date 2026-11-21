import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Glass tokens: existing pages that use navy-* automatically become translucent.
      colors: { navy: { 900: "rgba(6,10,28,0.55)", 800: "rgba(255,255,255,0.05)", 700: "rgba(255,255,255,0.09)", 600: "rgba(255,255,255,0.12)" } },
      keyframes: {
        fadeUp: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(40px,-30px) scale(1.12)" } },
        grow: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        growX: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        sheetUp: { from: { opacity: "0", transform: "translateY(24px) scale(.96)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        "fade-up": "fadeUp .55s cubic-bezier(.2,.8,.2,1) both",
        grow: "grow .8s cubic-bezier(.2,.8,.2,1) both",
        "grow-x": "growX .8s cubic-bezier(.2,.8,.2,1) both",
        "sheet-up": "sheetUp .3s cubic-bezier(.2,.8,.2,1) both",
        shimmer: "shimmer 2.2s linear infinite",
        bob: "bob 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
