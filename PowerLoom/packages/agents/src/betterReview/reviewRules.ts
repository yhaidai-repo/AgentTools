import type { ReviewRule } from "./models/ReviewRule";
import type { ReviewRuleDraft } from "./models/ReviewRuleDraft";

const RULES_FOLDER = "review-rules";
const RECORD_HEADING = /^## (\[RESOLVED\] )?(RV-(\d+))\b[ \t]*(.*)$/gm;
const STATUS_LINE = /^> \*\*(\w+)\*\*/m;
const ACTIVE = "active";

// The project rules of one repo (user decision 2026-10-16): a register note in the vault, `review-rules/<repo>.md`.
// Better Review reads it at the start of every review of the repo and appends what a run learned; the user edits or
// retires a rule in the note (`[RESOLVED]` in the heading, or a status other than Active).
export function reviewRulesPath(repoName: string): string {
  return `${RULES_FOLDER}/${repoName.replaceAll(/[^A-Za-z0-9._-]+/g, "-")}.md`;
}

export function parseReviewRules(noteText: string): ReviewRule[] {
  const headings = [...noteText.matchAll(RECORD_HEADING)];

  return headings.map((heading, index) => {
    const text = noteText.slice(heading.index, headings[index + 1]?.index).trim();
    const status = STATUS_LINE.exec(text)?.[1]?.toLowerCase() ?? ACTIVE;

    return { id: heading[2], title: heading[4].trim(), active: heading[1] === undefined && status === ACTIVE, text };
  });
}

// The note with the new rules appended, each with the next free id (never reused); a missing note starts from its header.
export function appendReviewRules(noteText: string | null, repoName: string, drafts: ReviewRuleDraft[], today: string, identities: string[] = []): { text: string; ids: string[]; suffix: string } {
  let text = (noteText ?? header(repoName, today)).trimEnd();
  let last = lastNumber(text);
  const ids: string[] = [];
  const additions: string[] = [];

  for (const [index, draft] of drafts.entries()) {
    const marker = identities[index] ? `<!-- powerloom-rule:${identities[index]} -->` : "";
    const existing = marker ? parseReviewRules(text).find(rule => rule.text.includes(marker)) : null;
    if (existing) { ids.push(existing.id); continue; }
    const id = `RV-${String(++last).padStart(3, "0")}`;

    ids.push(id);
    const addition = `\n\n${renderRule(id, draft, today)}${marker ? `\n${marker}` : ""}`;
    additions.push(addition);
    text += addition;
  }

  return { text: `${text}\n`, ids, suffix: additions.length === 0 ? "" : `${noteText === null ? header(repoName, today) : ""}${additions.join("")}\n` };
}

function lastNumber(text: string): number {
  return Math.max(0, ...[...text.matchAll(RECORD_HEADING)].map((match) => Number(match[3])));
}

function header(repoName: string, today: string): string {
  return [
    "---",
    `title: Review rules – ${repoName}`,
    "type: register",
    "audience: [dev, agent]",
    "status: current",
    `last_verified: ${today}`,
    "tags: [review-rules, code-review]",
    "---",
    `# Review rules – ${repoName}`,
    "",
    `What every review of ${repoName} follows. Better Review adds a **decision** when you decline a fix and it accepts your reason, and a **lesson** when another reviewer caught something it missed.`,
    "Edit a rule here as you like; retire one with `[RESOLVED]` in its heading or `> **Retired**` as its status line.",
  ].join("\n");
}

function renderRule(id: string, draft: ReviewRuleDraft, today: string): string {
  return [
    `## ${id} ${oneLine(draft.rule)}`,
    `> **Active** · ${draft.kind} · Created: ${today}`,
    `- Applies to: ${oneLine(draft.appliesTo)}`,
    `- Why: ${oneLine(draft.reason)}`,
    `- Source: ${oneLine(draft.source)}`,
    `- Quote: ${oneLine(draft.sourceText)}`,
  ].join("\n");
}

function oneLine(text: string): string {
  return text.trim().replaceAll(/\s*\n\s*/g, " ");
}
