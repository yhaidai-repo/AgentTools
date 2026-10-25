import { AdoTag } from "@/components/AdoTag";

// Where a review's pull request lives, and its link there: GitHub (user decision 2026-10-25) or Azure DevOps; a review
// without a PR page has no tag.
export function PrSiteTag({ url, origin }: { url: string | null; origin: string }) {
  if (origin !== "github" || !url) {
    return <AdoTag url={url} />;
  }

  return <a className="ado-tag" href={url} target="_blank" rel="noreferrer" title="Open on GitHub">GitHub ↗</a>;
}
