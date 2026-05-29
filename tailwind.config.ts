import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050506",
        success: "#9FE7C0",
        warning: "#F3D58A",
        danger: "#FFB4A8",
        purple: "#C9B8FF",
      },
    },
  },
  plugins: [],
} satisfies Config;
