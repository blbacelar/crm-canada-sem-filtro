import type { Config } from "tailwindcss";

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
        canada: {
          red: "#B71C3D",
          darkRed: "#9F1634",
        },
        slate: {
          850: "#172033",
          950: "#0B1120",
        },
      },
    },
  },
  plugins: [],
};
export default config;
