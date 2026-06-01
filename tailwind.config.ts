import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0C16",
        success: "#7FD5AA",
        warning: "#ECC666",
        danger: "#FF9B87",
        purple: "#B8A4FF",
      },
    },
  },
  plugins: [],
} satisfies Config;
