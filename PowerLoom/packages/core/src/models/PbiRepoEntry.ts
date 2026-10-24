// One repo of a PBI: its name, where it comes from (vault-documented, user-confirmed, agent-assumed, or refinement for
// PBIs refined before repos were recorded) and the repo question that asks about it.
export interface PbiRepoEntry {
  name: string;
  source: string;
  questionId: string | null;
}
