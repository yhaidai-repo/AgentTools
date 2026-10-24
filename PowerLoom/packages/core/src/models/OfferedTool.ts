/** A tool a run or a chat session was given: its name, its description's first sentence, and what gave it (a grant's label, "Every agent", "PowerLoom commands", …). */
export interface OfferedTool {
  name: string;
  summary: string;
  source: string;
}
