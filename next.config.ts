import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  // Runtime financial state and credentials must never enter deployment traces.
  outputFileTracingExcludes: {
    "/*": [
      "./.data/**/*",
      "./.env*",
      "./test-results/**/*",
      "./playwright-report/**/*",
    ],
  },
  distDir: process.env.FINANCE_E2E ? ".next-e2e" : ".next",
};
export default config;
