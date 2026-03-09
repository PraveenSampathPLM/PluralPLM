import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1B4F72",
        accent: "#E67E22",
        success: "#27AE60",
        warning: "#F39C12",
        danger: "#C0392B",
        sidebar: "#0F2027",
        mainbg: "#F8F9FA"
      },
      fontFamily: {
        heading: ["DM Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
