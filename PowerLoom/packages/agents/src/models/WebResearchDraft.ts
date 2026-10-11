// A topic an agent without web access wanted to look up; becomes a research task that needs the web.
export interface WebResearchDraft {
  topic: string;
  why: string;
  sources: string[];
}
