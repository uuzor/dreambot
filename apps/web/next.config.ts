import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The dashboard reads the same store the bot and worker use, and performs the
  // same operations through @dreampilot/ops. Those are workspace packages shipped
  // as TypeScript source with NodeNext-style "./x.js" import specifiers, so Next
  // has to transpile them and resolve those specifiers to .ts.
  transpilePackages: ["@dreampilot/store", "@dreampilot/ops", "@dreampilot/agent", "@dreampilot/risk", "@dreampilot/somnia"],
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
