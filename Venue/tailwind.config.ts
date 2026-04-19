import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        system: "#F2F2F7",
        surface: "#FFFFFF",
        muted: "#8E8E93",
        border: "#C6C6C8",
        accent: "#5AC8FA",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        card: "0 2px 16px rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
