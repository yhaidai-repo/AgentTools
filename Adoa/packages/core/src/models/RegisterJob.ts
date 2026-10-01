// The user submitted a finding to the vault: the worker adds the record to the project's register and closes the finding.
export interface RegisterJob {
  findingId: string;
  project: string;
  kind: "questions" | "issues";
  title: string;
  text: string;
  default: string[];
  options: string[];
}
