import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources.
  transpilePackages: ["@adoa/db", "@adoa/core", "@adoa/ado", "@agenttools/usage", "@agenttools/config"],
  serverExternalPackages: ["pg", "pg-boss"],
};

export default nextConfig;
