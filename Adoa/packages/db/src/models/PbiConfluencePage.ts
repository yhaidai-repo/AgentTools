// A Confluence page useful for a PBI's later agents, like a relevant vault doc: listed for them with why, opened by
// agents that have the Confluence tools (user decision 2026-10-02: links only, not fetched).
export interface PbiConfluencePage {
  url: string;
  title: string;
  why: string;
  by: "user" | "refinement" | "research";
}
