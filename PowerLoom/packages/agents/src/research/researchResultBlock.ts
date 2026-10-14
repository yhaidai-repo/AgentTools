import { localItem } from "@powerloom/db";
import type { ResearchResultOutput } from "./models/ResearchResultOutput";

type ItemRow = typeof localItem.$inferSelect;

// One research result as the next agent reads it: the question it answers, the conclusion, findings, evidence and
// where to read on.
export function resultBlock(result: ItemRow, task: ItemRow | undefined): string {
  const data = result.data as ResearchResultOutput;

  return [
    `## ${result.id} for ${task?.id ?? "?"}: ${task?.body ?? task?.title ?? result.title}`,
    `Conclusion (${data.confidence}): ${data.conclusion}`,
    `Findings:\n${lines(data.findings)}`,
    `Evidence:\n${lines(data.evidence.map((item) => `${item.location}: ${item.note}`))}`,
    `Docs to read:\n${lines(data.relevantDocs.map((doc) => `${doc.path}: ${doc.why}`))}`,
    `Code to read:\n${lines(data.codeRefs.map((ref) => `${ref.location}: ${ref.why}`))}`,
  ].join("\n");
}

export function lines(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}
