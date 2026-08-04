import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        atlas: {
          navy: "#0a1628",
          dark: "#0f2744",
          accent: "#00d4ff",
          blue: "#0077ff",
          light: "#e8f4fc",
        },
      },
    },
  },
  plugins: [],
};

export default config;
