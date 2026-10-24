import type { Evidence } from "../../models/Evidence";

// One fact a research run found, with the sources that show it.
export interface ResearchFinding {
  fact: string;
  evidence: Evidence[];
  certainty: "verified" | "inferred";
}
