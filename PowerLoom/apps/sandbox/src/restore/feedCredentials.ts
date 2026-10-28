import type { FeedCredential } from "@powerloom/sandbox";

// `dotnet nuget list source --format Detailed`: "  1.  name [Enabled]" with the URL on the next line.
const NUGET_SOURCE = /^\s*\d+\.\s+(.+?)\s+\[(?:Enabled|Disabled)\]\s*\r?\n\s*(\S+)/gm;
// .npmrc lines naming a registry: `registry=URL` or `@scope:registry=URL`.
const NPM_REGISTRY = /^\s*(?:@[^:\s]+:)?registry\s*=\s*(\S+)\s*$/gm;

/** The NuGet sources the repo's own nuget.config files name, by name and URL. */
export function nugetSourcesOf(listing: string): { name: string; url: string }[] {
  return [...listing.matchAll(NUGET_SOURCE)].map((match) => ({ name: match[1], url: match[2] }));
}

/** One NuGet credential variable per source whose URL a credential covers; sources elsewhere get none. */
export function nugetCredentialEnv(sources: { name: string; url: string }[], credentials: FeedCredential[]): string[] {
  return sources.flatMap((source) => {
    const credential = credentialFor(source.url, credentials);

    return credential ? [`NuGetPackageSourceCredentials_${source.name}=Username=${credential.username};Password=${credential.password};ValidAuthenticationTypes=basic`] : [];
  });
}

/** The user .npmrc lines that sign in to the registries the repo's .npmrc names; null when none is covered. */
export function npmrcAuth(npmrc: string | null, credentials: FeedCredential[]): string | null {
  const registries = npmrc === null ? [] : [...npmrc.matchAll(NPM_REGISTRY)].map((match) => match[1]);
  const lines = registries.flatMap((registry) => authLines(registry, credentialFor(registry, credentials)));

  return lines.length > 0 ? `${lines.join("\n")}\n` : null;
}

function authLines(registry: string, credential: FeedCredential | null): string[] {
  if (!credential) {
    return [];
  }

  const key = registry.replace(/^https?:/, "").replace(/\/?$/, "/");

  return [`${key}:username=${credential.username}`, `${key}:_password=${Buffer.from(credential.password, "utf8").toString("base64")}`, `${key}:email=npm@powerloom.local`];
}

function credentialFor(url: string, credentials: FeedCredential[]): FeedCredential | null {
  const lower = url.toLowerCase();

  return credentials.find((credential) => credential.urlPrefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()))) ?? null;
}
