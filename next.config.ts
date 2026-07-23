import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2"],
  experimental: {
    optimizePackageImports: ["leaflet"],
  },
  async headers() {
    return [
      {
        source: "/api/og/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "X-Robots-Tag", value: "all" },
        ],
      },
      {
        source: "/pet/:slug*",
        headers: [{ key: "X-Robots-Tag", value: "all" }],
      },
    ];
  },
};

export default nextConfig;
