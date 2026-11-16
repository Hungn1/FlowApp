import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its built-in font files from disk, so keep it out of the bundle.
  serverExternalPackages: ["pdfkit"],
  // Don't rebuild/reload the app every time the local database file changes.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/prisma/*.db", "**/prisma/*.db-journal"],
    };
    return config;
  },
};

export default nextConfig;
