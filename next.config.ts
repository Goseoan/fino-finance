import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  distDir: process.env.FINANCE_E2E ? ".next-e2e" : ".next",
};
export default config;
