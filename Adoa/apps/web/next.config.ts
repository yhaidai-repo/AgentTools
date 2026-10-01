import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources.
  transpilePackages: ["@adoa/db", "@adoa/core", "@adoa/ado", "@adoa/attachments", "@adoa/vault", "@agenttools/usage", "@agenttools/config"],
  // The PDF and Word readers load their own workers and files at runtime, so they stay unbundled.
  serverExternalPackages: ["pg", "pg-boss", "unpdf", "mammoth"],
  experimental: {
    // Uploads go through a server action: 20 MB files (MAX_ATTACHMENT_BYTES) plus the form fields.
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
