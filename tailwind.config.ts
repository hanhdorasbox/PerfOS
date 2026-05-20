import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#050506",
        success: "#6BE3A4",
        warning: "#F2C063",
        danger: "#FF6B6B",
        purple: "#B4A7E5",
      },
    },
  },
  plugins: [],
} satisfies Config;
