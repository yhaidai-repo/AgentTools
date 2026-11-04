import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources (core pulls the vault, sql, confluence and usage packages in).
  transpilePackages: ["@powerloom/db", "@powerloom/core", "@powerloom/client", "@powerloom/vault", "@powerloom/sql", "@powerloom/confluence", "@agenttools/usage", "@agenttools/config"],
  serverExternalPackages: ["pg", "mssql"],
  // No generated AGENTS.md / CLAUDE.md in the app folder: the vault and the repo root hold the agent rules.
  agentRules: false,
  // The app is opened as 127.0.0.1 (the web app's vault cookie is shared on that host): let the dev server serve it there.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
