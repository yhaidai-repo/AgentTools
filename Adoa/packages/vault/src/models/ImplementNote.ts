import type { DesignNote } from "./DesignNote";
import type { ImplementNoteLink } from "./ImplementNoteLink";

// The handoff note's data: what a Claude desktop chat reads first to implement the PBI ("Continue with Claude").
export interface ImplementNote {
  adoId: number;
  title: string;
  designVersion: number;
  updated: Date;
  readFirst: ImplementNoteLink[];
  repos: string[];
  skills: { name: string; reason: string }[];
  plan: DesignNote["plan"];
  tests: DesignNote["tests"];
}
