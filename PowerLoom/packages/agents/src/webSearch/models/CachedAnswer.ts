import type { WebSearchAnswer } from "./WebSearchAnswer";

export interface CachedAnswer {
  answer: WebSearchAnswer;
  savedAt: number;
}
