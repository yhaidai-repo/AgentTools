import { guideChecksum, type GuideImage, type GuidePackageData, type GuideReport, type GuideRequest, type ArchiveFile } from "@powerloom/core";

export function buildGuidePackage(input: {
  packageId: string; taskId: string; runId: number; pbiId: number | null; vault: string;
  request: GuideRequest; guide: GuideReport; images: GuideImage[]; contents: Map<string, Buffer>; commits: Record<string, string>;
}): GuidePackageData {
  const contents: ArchiveFile[] = [
    { path: "guide.md", content: Buffer.from(input.guide.markdown) },
    { path: "verification.md", content: Buffer.from(input.guide.verification) },
    ...input.images.map(i => ({ path: "images/" + i.name, content: input.contents.get(i.id)! })),
  ];
  if (contents.some(f => !f.content)) throw new Error("Missing image bytes");
  const contentChecksum = guideChecksum(contents);
  const ready = input.guide.status === "ready" && input.request.destination.action !== "unspecified";
  const manifest = {
    schemaVersion: 1, packageId: input.packageId, taskId: input.taskId, runId: input.runId, pbiId: input.pbiId, vault: input.vault,
    guideline: "powerloom-support-guide/v1", request: input.request, commits: input.commits,
    guideStatus: input.guide.status, buildIdentity: input.guide.buildIdentity, verifiedAt: input.guide.verifiedAt,
    configuration: input.guide.configuration, workflows: input.guide.workflows, rules: input.guide.rules, blockers: input.guide.blockers,
    images: input.images, contentChecksum, checksumScope: contents.map(f => f.path),
    retention: "Publication assets stay in database history; DevHub recordings have independent retention.",
  };
  const files = [
    ...contents.filter(f => !f.path.startsWith("images/")).map(f => ({ path: f.path, text: f.content.toString("utf8") })),
    { path: "manifest.json", text: JSON.stringify(manifest, null, 2) },
    { path: "publish-task.md", text: ready ? publishTask(input.request, input.packageId, contentChecksum, input.images) : "Publication blocked: finish the guide and supply its create/update destination. This is a checkpoint." },
  ];
  return { schemaVersion: 1, packageId: input.packageId, taskId: input.taskId, runId: input.runId, pbiId: input.pbiId, vault: input.vault, guide: input.guide, images: input.images, files, contentChecksum, publicationStatus: ready ? "pending" : "awaiting-details" };
}
export function publishTask(r: GuideRequest, id: string, checksum: string, images: GuideImage[]): string {
  const d = r.destination;
  if (d.action === "unspecified") throw new Error("Publication destination missing");
  return [
    "# " + (d.action === "create" ? "Create" : "Update") + " support guide: " + d.title,
    "", "Package: " + id, "Content checksum (algorithm/scope in manifest.json): " + checksum,
    "Site: " + d.site, "Space: " + d.space, "Owner: " + r.owner, "Audience: " + r.audience,
    d.action === "create" ? "Parent page id: " + d.parentId : "Page id: " + d.pageId + "; expected base version: " + d.version + "; owned scope: " + d.sections,
    "", "Use guide.md as the exact reader-facing content; verification.md is authoring evidence only.",
    "", "## Attachment map", ...images.map(i => "- images/" + i.name + " → " + i.name + " · sha256 " + i.sha256 + " · alt: " + i.alt + " · caption: " + i.caption),
    "", "## Apply",
    "1. Verify checksum and target access. Search for this package identity before creating anything; retry the same page/attachments rather than duplicate them.",
    "2. Read the target. Updates require the expected base version; reconcile newer content first. Preserve unrelated sections, comments, attachments and access restrictions.",
    "3. Convert Markdown into supported Confluence content. Upload only listed sanitized images and replace relative links with native attachment references.",
    "4. Save the complete page. Inspect rendered headings, numbering, tables, links, captions and image order/legibility. An upload alone is not completion.",
    "5. Return page URL/id, saved version, package identity/checksum, attachment map and rendered verification evidence to the originating task. No automatic publisher route is assumed.",
    "", "If blocked, return the precise problem and partial result. After an unclear write response, read the page before retrying.",
  ].join("\n");
}
