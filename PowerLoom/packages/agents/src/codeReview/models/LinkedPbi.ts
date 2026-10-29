// A work item the pull request links, with what PowerLoom knows about it (null fields: not in PowerLoom or not refined/planned yet).
// A child item (e.g. a QA [BUG] Task) names its parent PBI, whose criteria the fix must keep.
export interface LinkedPbi {
  adoId: number;
  title: string | null;
  refinementSummary: string | null;
  planSummary: string | null;
  parent: { adoId: number; title: string } | null;
}
