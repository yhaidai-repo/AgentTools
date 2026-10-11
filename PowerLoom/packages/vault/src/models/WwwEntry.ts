// One What-went-wrong record as the www-record skill defines it; empty optional fields are written as "–".
export interface WwwEntry {
  title: string;
  kind: "complaint" | "notice";
  project: string;
  planned: string;
  happened: string;
  fault: "Human" | "Agent";
  rootCause: string | null;
  resolution: string | null;
  preventiveAction: string | null;
  assumptions: string | null;
}
