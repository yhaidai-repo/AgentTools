import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources.
  transpilePackages: ["@powerloom/db", "@powerloom/core", "@powerloom/ado", "@powerloom/attachments", "@powerloom/vault", "@agenttools/usage", "@agenttools/config", "@agenttools/runtime"],
  // The PDF and Word readers load their own workers and files at runtime, so they stay unbundled.
  serverExternalPackages: ["pg", "unpdf", "mammoth"],
  experimental: {
    // Uploads go through a server action: 20 MB files (MAX_ATTACHMENT_BYTES) plus the form fields.
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
