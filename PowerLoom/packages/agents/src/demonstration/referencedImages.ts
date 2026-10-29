import { guideImageReferences, type GuideImage, type GuideReport } from "@powerloom/core";

// Workflow references are valid before draft Markdown embeds them; package both sets consistently.
export function referencedImages(report: Pick<GuideReport, "markdown" | "workflows">, saved: GuideImage[]): GuideImage[] {
  const names = new Set([
    ...guideImageReferences(report.markdown).urls.filter(url => url.startsWith("images/")).map(url => url.slice(7)),
    ...report.workflows.flatMap(workflow => workflow.images ?? []),
  ]);
  return saved.filter(image => names.has(image.name));
}
