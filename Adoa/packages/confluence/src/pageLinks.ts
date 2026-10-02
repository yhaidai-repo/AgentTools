// The page a Confluence Cloud link points to: `/wiki/spaces/<space>/pages/<id>/<title>` or `…?pageId=<id>`.
// Null for other forms (e.g. short `/wiki/x/…` links), which can't be resolved without following them.
export function confluencePageId(url: string): string | null {
  const parsed = new URL(url);
  const fromPath = parsed.pathname.match(/\/wiki\/spaces\/[^/]+\/pages\/(\d+)/)?.[1];

  return fromPath ?? parsed.searchParams.get("pageId");
}

// The site's base, e.g. https://approvedadmissions.atlassian.net.
export function confluenceSite(url: string): string {
  return new URL(url).origin;
}
