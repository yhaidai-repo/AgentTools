import type { GuidePackageData } from "@powerloom/core";
import type { ItemRow } from "@/lib/pbiDetail";
import { MarkdownBlock } from "@/components/MarkdownBlock";

export function SupportGuideContent({ item }: { item: ItemRow }) {
  const pkg = (item.data as { guidePackage?: GuidePackageData } | null)?.guidePackage;
  if (!pkg) return <p className="muted">No guide package.</p>;
  const imageUrls = Object.fromEntries(pkg.images.map(image => ["images/" + image.name, "/guides/" + encodeURIComponent(item.id) + "/images/" + image.name]));
  return <>
    <p>Guide: <strong>{pkg.guide.status}</strong> · Publication: <strong>{pkg.publicationStatus}</strong></p>
    <p className="muted">Publication is tracked outside PowerLoom in v1: pending means the handoff is ready for an authorized publisher; PowerLoom does not record the published page.</p>
    <p><a className="button" href={"/guides/" + encodeURIComponent(item.id) + "/download"}>Download guide and screenshots</a></p>
    <p className="muted">Images stay with this task’s history, independently of temporary browser recordings.</p>
    <MarkdownBlock text={pkg.guide.markdown} imageUrls={imageUrls} />
    <details><summary>Publication handoff</summary><MarkdownBlock text={pkg.files.find(f => f.path === "publish-task.md")?.text ?? "Not prepared."} imageUrls={{}} /></details>
    <details><summary>Verification and remaining work</summary><MarkdownBlock text={pkg.guide.verification} imageUrls={{}} /><ul>{pkg.guide.blockers.map(b => <li key={b}>{b}</li>)}</ul></details>
    <details><summary>Manifest</summary><pre>{pkg.files.find(f => f.path === "manifest.json")?.text}</pre></details>
  </>;
}
