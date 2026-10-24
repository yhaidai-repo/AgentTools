// What the tech-writer stores on a finding (local_item.data).
export interface FindingData {
  type: "question" | "issue";
  project: string;
  default?: string[];
  options?: string[];
}
