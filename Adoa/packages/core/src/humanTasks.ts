import type { HumanTaskData } from "./models/HumanTaskData";
import type { HumanTaskStep } from "./models/HumanTaskStep";

// Steps that read logs or data must come with the query to run (user decision 2026-10-05).
export const QUERY_SOURCES: HumanTaskStep["source"][] = ["app-insights", "log-analytics", "cosmos", "sql"];
export const MAX_REASON_CHARS = 300;

const SOURCE_LABELS: Record<HumanTaskStep["source"], string> = {
  "app-insights": "App Insights",
  "log-analytics": "Log Analytics",
  cosmos: "Cosmos DB",
  sql: "SQL",
  portal: "Azure portal",
  ado: "Azure DevOps",
  other: "Other",
};

export function isHumanTaskData(data: unknown): data is HumanTaskData {
  return typeof data === "object" && data !== null && Array.isArray((data as HumanTaskData).steps);
}

export function sourceLabel(source: HumanTaskStep["source"]): string {
  return SOURCE_LABELS[source];
}

// The task's body as markdown: what agents read back in `<existing-items>` and the Vault item note shows.
export function renderHumanTaskBody(data: HumanTaskData): string {
  return [`**Why:** ${data.why}`, `**Solves:** ${data.solves}`, ...data.steps.map(renderStep)].join("\n\n");
}

// The person's per-step answers as markdown, so the next agent maps each answer to its step. JSON goes into a code block.
export function humanTaskResolution(data: HumanTaskData, answers: string[], note: string | null): string | null {
  const answered = data.steps.map((step, index) => ({ step, index, answer: answers[index]?.trim() ?? "" })).filter((entry) => entry.answer !== "");
  const parts = answered.map((entry) => `### ${entry.index + 1}. ${entry.step.action}\n\n${asCodeBlockIfJson(entry.answer)}`);
  const all = [...parts, ...(note ? [`### Note\n\n${note}`] : [])];

  return all.length > 0 ? all.join("\n\n") : null;
}

function renderStep(step: HumanTaskStep, index: number): string {
  const where = `**Where:** ${sourceLabel(step.source)}: ${step.resource}${step.timeRange ? ` · **Time range:** ${step.timeRange}` : ""}`;
  const query = step.query ? [`\`\`\`${step.query.language}\n${step.query.text.trim()}\n\`\`\``] : [];

  return [`### Step ${index + 1}: ${step.action}`, where, ...query, `**Report back:** ${step.reportBack}`].join("\n\n");
}

function asCodeBlockIfJson(text: string): string {
  return looksLikeJson(text) ? `\`\`\`json\n${text}\n\`\`\`` : text;
}

function looksLikeJson(text: string): boolean {
  const isWrapped = /^[[{][\s\S]*[\]}]$/.test(text);

  return isWrapped && !text.includes("```");
}
