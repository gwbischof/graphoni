import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["neo4j-driver", "pg"],
};

export default nextConfig;
