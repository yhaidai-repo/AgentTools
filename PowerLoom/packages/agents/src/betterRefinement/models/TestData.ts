import type { EvidencedItem } from "./EvidencedItem";

// Whether the PBI gives the data a tester or developer needs (records, ids, environments, payloads, steps), and what is
// missing; read from the PBI's description, notes, attachments and answers, never from a database (user, 2026-10-13).
export interface TestData {
  applicable: boolean;
  given: EvidencedItem[];
  missing: string[];
  reason: string;
}
