// What bug.report takes: the parent PBI as a link or id, and the bug in the reporter's words.
export interface ReportBugInput {
  parent: string;
  title: string;
  descriptionMd: string | null;
  priority: number;
}
