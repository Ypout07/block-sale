import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // xrpl must not be bundled by webpack — let Node.js require it natively
  serverExternalPackages: ["xrpl", "ws"],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
