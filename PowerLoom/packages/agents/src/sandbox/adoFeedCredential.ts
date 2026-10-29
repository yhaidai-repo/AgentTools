import type { FeedCredential } from "@powerloom/sandbox";

const DEV_AZURE = /^https?:\/\/dev\.azure\.com\/([^/]+)/i;
const VISUAL_STUDIO = /^https?:\/\/([^.]+)\.visualstudio\.com/i;

// The vault's Azure DevOps token as a package-feed sign-in (user decision 2026-10-28, OQ-3): only for the feeds of the
// vault's own organization, under both of Azure Artifacts' host names. Null when the vault has no organization or token.
export function adoFeedCredential(orgUrl: string, pat: string): FeedCredential | null {
  const organization = organizationOf(orgUrl);

  if (!organization || !pat) {
    return null;
  }

  return { urlPrefixes: [`https://pkgs.dev.azure.com/${organization}/`, `https://${organization}.pkgs.visualstudio.com/`], username: "powerloom", password: pat };
}

/** The hosts a restore of the organization's feeds reaches: the feeds, and the blob storage their packages download from. */
export function adoFeedHosts(orgUrl: string): string[] {
  const organization = organizationOf(orgUrl);

  if (!organization) {
    return [];
  }

  // Azure Artifacts redirects package downloads to randomly named storage accounts (`<random>vsblobprod<region><n>`).
  return ["pkgs.dev.azure.com", `${organization.toLowerCase()}.pkgs.visualstudio.com`, "*.vsblob.vsassets.io", "*vsblobprod*.blob.core.windows.net"];
}

function organizationOf(orgUrl: string): string | undefined {
  return DEV_AZURE.exec(orgUrl)?.[1] ?? VISUAL_STUDIO.exec(orgUrl)?.[1];
}
