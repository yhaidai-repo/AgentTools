// An open question or known issue the tech-writer found; the user reviews it before anything reaches a register.
export interface FindingDraft {
  type: "question" | "issue";
  project: string;
  title: string;
  text: string;
  default: string[];
  options: string[];
}
