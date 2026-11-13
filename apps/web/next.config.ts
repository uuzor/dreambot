import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The dashboard reads the same store the bot and worker use. That package is a
  // workspace shipped as TypeScript source with NodeNext-style "./x.js" import
  // specifiers, so Next has to transpile it and resolve those specifiers to .ts.
  transpilePackages: ["@dreampilot/store"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.prod-runtime.all-hands.dev"],
};

export default config;
