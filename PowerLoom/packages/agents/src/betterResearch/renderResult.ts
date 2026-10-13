import { readableResult } from "./commitBetterResearch";
import type { BetterResearchResult } from "./models/BetterResearchResult";

// A goal task's resolution: the result as Markdown, with the same folded findings every other reader shows.
export function renderResult(result: BetterResearchResult): string {
  const readable = readableResult(result);

  return [
    `**Question:** ${result.question}`,
    `**Answer** (${result.status}, confidence ${result.confidence}): ${result.conclusion}`,
    "",
    "## Findings",
    ...bullets(readable.findings),
    "",
    "## Evidence",
    ...bullets(readable.evidence.map((item) => `\`${item.location}\`: ${item.note}`)),
    "",
    "## Start here",
    ...bullets(result.startPoints.map((point) => `\`${point.location}\`: ${point.why}`)),
    "",
    "## Next",
    result.nextReason,
  ].join("\n");
}

function bullets(lines: string[]): string[] {
  return lines.length > 0 ? lines.map((line) => `- ${line}`) : ["- none"];
}
