import type { GuideImage, GuideReport } from "@powerloom/core";
import { GUIDE_IMAGE_NAME, guideImageReferences, guideUrlAllowed, type GuideRequest } from "@powerloom/core";
import type { ReadLog } from "../evidence/ReadLog";

export function guideProblems(r: GuideReport, request: GuideRequest, images: GuideImage[], log: ReadLog, owner: string): string[] {
  const problems: string[] = [], names = new Set(images.map(i => i.name));
  const parsed = guideImageReferences(r.markdown);
  for (const ref of parsed.urls) if (!ref.startsWith("images/") || !GUIDE_IMAGE_NAME.test(ref.slice(7)) || !names.has(ref.slice(7))) problems.push("Image is not approved: " + ref);
  if (parsed.html) problems.push("Use Markdown without embedded HTML");
  for (const w of r.workflows) {
    for (const name of w.images) if (!names.has(name)) problems.push("Unknown workflow image: " + name);
    if (w.state === "observed" && (!w.observed.trim() || !isBrowserEvidence(log, w.source, request))) problems.push("Workflow needs a fresh allowed-page browser observation: " + w.id);
  }
  for (const rule of r.rules) {
    if (!log.find(rule.source)) problems.push("Unread rule source: " + rule.source);
    if (rule.certainty === "observed" && !isBrowserEvidence(log, rule.source, request)) problems.push("Observed rule needs fresh browser evidence: " + rule.claim);
  }
  if (r.status !== "ready") return problems;
  if (!r.markdown.trim() || r.blockers.length || r.workflows.some(w => w.state !== "observed") || r.rules.some(rule => rule.certainty === "unresolved")) problems.push("Ready requires completed workflows and no unresolved rules/blockers");
  problems.push(...mediaProblems(images, r, owner), ...identityProblems(r, request, log));
  if (/<[^>]+>|\b(?:TODO|TBD|FIXME)\b/.test(r.markdown)) problems.push("Resolve authoring placeholders");
  for (const h of ["Overview", "Before you begin", "Confirm completion"]) if (!r.markdown.includes("## " + h)) problems.push("Missing section: " + h);
  return problems;
}
function mediaProblems(images: GuideImage[], r: GuideReport, owner: string): string[] {
  const problems: string[] = [];
  const stills = images.filter((image) => (image.mediaType ?? "image/png") === "image/png");

  if (!stills.length) {
    problems.push("Ready requires inspected screenshots");
  }

  if (images.some((image) => image.buildIdentity !== r.buildIdentity || image.sourceOwner !== owner)) {
    problems.push("Recapture screenshots in this run for the documented build");
  }

  for (const image of images.filter((i) => i.approved === false)) {
    problems.push(`View and approve ${image.name} (approve_guide_image)`);
  }

  return problems;
}

// A claimed deployment or release must be visible in the cited fresh observation, not only asserted by the agent.
function identityProblems(r: GuideReport, request: GuideRequest, log: ReadLog): string[] {
  const problems: string[] = [];
  const release = request.release.trim();

  if (request.mode === "local-stack" && !runtimeIdentityRead(log, r.buildSource, r.buildIdentity, request)) {
    problems.push("Local guides need fresh DevHub runtime build identity, not repository-cache commits");
  }

  if (request.mode === "remote-url" && r.buildIdentity !== "unknown" && !browserShows(log, r.buildSource, request, r.buildIdentity)) {
    problems.push("Remote identity must appear in the cited current browser observation");
  }

  if (release && (!r.releaseVerified || r.buildIdentity === "unknown" || !r.releaseSource || !browserShows(log, r.releaseSource, request, release))) {
    problems.push(`Release-specific guides need a fresh browser observation (releaseSource) showing "${release}"`);
  }

  return problems;
}

function browserShows(log: ReadLog, id: string, request: GuideRequest, text: string): boolean {
  return isBrowserEvidence(log, id, request) && (log.find(id)?.resultText ?? "").includes(text);
}

export function isBrowserEvidence(log: ReadLog, id: string, request: GuideRequest): boolean {
  const s = log.find(id);
  if (!s?.fresh || !s.tool?.startsWith("browser_") || s.tool === "browser_take_screenshot") return false;
  const url = /^- Page URL:\s*(\S+)/m.exec(s.resultText ?? "")?.[1];
  return url !== undefined && guideUrlAllowed(url, request.allowedOrigins);
}
function runtimeIdentityRead(log: ReadLog, id: string, identity: string, request: GuideRequest): boolean {
  const branch = request.branch;
  const s = log.find(id);
  if (!s?.fresh || !["start_stack", "stack_status"].includes(s.tool ?? "") || !(s.resultText ?? "").includes("Phase: ready; running; yours") || /; branch ([^;\r\n]+)/.exec(s.resultText ?? "")?.[1] !== branch) return false;
  if (!(s.resultText ?? "").includes("Strict branch: true")) return false;
  const runningUrls = [...(s.resultText ?? "").matchAll(/^\|\s*([^|]+)\|\s*running\s*\|\s*([^|]+)\|/gm)].filter(match => request.services.includes(match[1].trim())).map(match => match[2].trim());
  if (!runningUrls.some(url => guideUrlAllowed(url, [new URL(request.url).origin]))) return false;
  const json = /^Runtime build identity: (.+)$/m.exec(s.resultText ?? "")?.[1];
  if (!json) return false;
  try {
    const actual = JSON.parse(json) as Record<string, string>;
    return Object.keys(actual).length > 0 && Object.values(actual).every(v => /^[a-f0-9]{40};source=[a-f0-9]{64}$/.test(v)) && JSON.stringify(actual) === identity;
  } catch { return false; }
}
