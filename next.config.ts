import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "@prisma/client", "jose"],
};

export default nextConfig;
