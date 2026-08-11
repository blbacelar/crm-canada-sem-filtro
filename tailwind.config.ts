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
          red: "#EF4444",
          darkRed: "#DC2626",
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
