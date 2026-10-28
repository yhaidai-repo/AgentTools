import type { FeedCredential } from "@powerloom/sandbox";

const DEV_AZURE = /^https?:\/\/dev\.azure\.com\/([^/]+)/i;
const VISUAL_STUDIO = /^https?:\/\/([^.]+)\.visualstudio\.com/i;

// The vault's Azure DevOps token as a package-feed sign-in (user decision 2026-10-28, OQ-3): only for the feeds of the
// vault's own organization, under both of Azure Artifacts' host names. Null when the vault has no organization or token.
export function adoFeedCredential(orgUrl: string, pat: string): FeedCredential | null {
  const organization = DEV_AZURE.exec(orgUrl)?.[1] ?? VISUAL_STUDIO.exec(orgUrl)?.[1];

  if (!organization || !pat) {
    return null;
  }

  return { urlPrefixes: [`https://pkgs.dev.azure.com/${organization}/`, `https://${organization}.pkgs.visualstudio.com/`], username: "powerloom", password: pat };
}
