// A record for a project's register: an open question or a known issue.
export interface RegisterRecordInput {
  project: string;
  kind: "questions" | "issues";
  title: string;
  text: string;
  default: string[];
  options: string[];
}
