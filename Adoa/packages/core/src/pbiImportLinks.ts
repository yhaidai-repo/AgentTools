import type { AdoSettings } from "./models/AdoSettings";
import { parsePbiReference } from "./pbiAdmin";
import { extractUrls } from "./urls";

// Outlook (Defender Safe Links) wraps every link in a mail: …safelinks.protection.outlook.com/?url=<encoded link>&…
const SAFE_LINKS_HOST = /\.safelinks\.protection\.outlook\.com$/i;

// The PBIs an imported item links: only work item links of the configured org and project count. Bare numbers don't,
// because mails mention other ids too (e.g. "[587484]" is a Freshdesk ticket).
export function extractPbiLinks(ado: AdoSettings, html = "", text = ""): number[] {
  const urls = extractUrls(`${decodeHtmlAmpersands(html)}\n${text}`).map(unwrapSafeLink);
  const ids = urls.filter((url) => isProjectWorkItemUrl(ado, url)).map(parsePbiReference);

  return [...new Set(ids.filter((id): id is number => id !== null))];
}

function decodeHtmlAmpersands(html: string): string {
  return html.replace(/&amp;/gi, "&");
}

function unwrapSafeLink(url: string): string {
  const parsed = parseUrl(url);
  const wrapped = parsed && SAFE_LINKS_HOST.test(parsed.hostname) ? parsed.searchParams.get("url") : null;

  return wrapped ?? url;
}

// dev.azure.com/<org>/<project>/… or the older <org>.visualstudio.com/<project>/…
function isProjectWorkItemUrl(ado: AdoSettings, url: string): boolean {
  const projectBase = projectBaseUrls(ado).find((base) => url.toLowerCase().startsWith(base));

  return !!projectBase && /\/_workitems\//i.test(url);
}

function projectBaseUrls(ado: AdoSettings): string[] {
  const orgUrl = ado.orgUrl.replace(/\/+$/, "").toLowerCase();
  const org = orgUrl.split("/").pop() ?? "";
  const projects = [ado.project, encodeURIComponent(ado.project)].map((project) => project.toLowerCase());
  const orgBases = [orgUrl, `https://${org}.visualstudio.com`];

  return orgBases.flatMap((base) => projects.map((project) => `${base}/${project}/`));
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
