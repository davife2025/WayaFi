import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { "irofi-green": "#00D4A8" } } },
  plugins: [],
};
export default config;
