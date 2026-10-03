// A work item the pull request links, with what adoa knows about it (null fields: not in adoa or not refined/designed yet).
export interface LinkedPbi {
  adoId: number;
  title: string | null;
  refinementSummary: string | null;
  designApproach: string | null;
}
