// A record to add to a register (the user submitted a finding).
export interface NewRegisterRecord {
  project: string;
  kind: "questions" | "issues";
  title: string;
  text: string;
  default: string[];
  options: string[];
}
