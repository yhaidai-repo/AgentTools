import type { Evidence } from "../../models/Evidence";

// One write_result call: what the run produced, in the shape every agent's result shares (user decision 2026-10-22).
export interface ResultDraft {
  /** complete: the task is done; partial: what there is so far; blocked: something stops it, named in the body. */
  status: "complete" | "partial" | "blocked";
  /** The result in Markdown, in the sections the agent's prompt asks for. */
  body: string;
  /** The structured result, when the agent's prompt asks for one; null otherwise. */
  data: object | null;
  evidence: Evidence[];
}
