import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "@prisma/client", "jose"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "http2.mlstatic.com",
      },
      {
        protocol: "https",
        hostname: "http2.mlstatic.com",
      },
      {
        protocol: "http",
        hostname: "*.mlstatic.com",
      },
      {
        protocol: "https",
        hostname: "*.mlstatic.com",
      },
    ],
  },
};

export default nextConfig;
