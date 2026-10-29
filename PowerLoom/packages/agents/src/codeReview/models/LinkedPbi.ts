// A work item the pull request links, with what PowerLoom knows about it (null fields: not in PowerLoom or not refined/designed yet).
// A child item (e.g. a QA [BUG] Task) names its parent PBI, whose criteria the fix must keep.
export interface LinkedPbi {
  adoId: number;
  title: string | null;
  refinementSummary: string | null;
  designApproach: string | null;
  parent: { adoId: number; title: string } | null;
}
