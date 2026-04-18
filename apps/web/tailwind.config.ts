import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        slateNight: "#1f2937",
        slateMist: "#94a3b8",
        creme: "#f8f1e5",
        ember: "#c96f3b",
        mint: "#72bda3"
      }
    }
  },
  plugins: []
};

export default config;
