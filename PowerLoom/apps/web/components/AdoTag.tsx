// The mark of an item that lives in Azure DevOps, and its link there (user, 2026-10-18: mark ADO items, not local ones).
export function AdoTag({ url }: { url: string | null }) {
  if (!url) {
    return null;
  }

  return <a className="ado-tag" href={url} target="_blank" rel="noreferrer" title="Open in Azure DevOps">ADO ↗</a>;
}
