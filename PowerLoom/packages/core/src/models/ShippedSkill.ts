// A skill PowerLoom ships, as its API's start last applied it (config key skills:shipped): the shipped text's hash, when,
// and the revision that keeps the edited text it replaced (null when nothing was replaced).
export interface ShippedSkill {
  hash: string;
  appliedAt: string;
  replacedRevisionId: number | null;
}
