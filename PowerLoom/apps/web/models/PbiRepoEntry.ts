// One repo of a PBI as its page shows it; source "added" = picked in the form, not saved yet.
export interface PbiRepoEntry {
  name: string;
  source: string;
  questionId: string | null;
}
