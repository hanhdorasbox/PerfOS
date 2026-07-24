import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0C16",
        success: "#64f0aa",
        warning: "#ffce53",
        danger: "#ff8168",
        purple: "#a085ff",
      },
    },
  },
  plugins: [],
} satisfies Config;
