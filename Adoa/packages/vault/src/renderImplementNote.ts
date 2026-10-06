import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { ImplementNote } from "./models/ImplementNote";
import { designNoteName, implementNoteName, pbiNoteName } from "./paths";

// The chat's first answer (user decision 2026-10-05): a plain-language briefing, then a request to implement. adoa can't
// tell bugs from features (ADO types and tags are used loosely), so the chat picks the outline after reading the PBI.
const BUG_BRIEFING = [
  "**The problem**: in short, what goes wrong and why, in 2–3 sentences.",
  "**How it should work**: the intended flow, step by step.",
  "**Where it breaks**: each cause with `file:line`; a table when several places behave differently.",
  "**How this explains each symptom**: every reported symptom and acceptance criterion, tied to its cause.",
];

const FEATURE_BRIEFING = [
  "**The goal**: in short, what the user gets and why, in 2–3 sentences.",
  "**How it works today**: the current flow the change builds on, with `file:line`.",
  "**What changes**: the new behaviour for every acceptance criterion; a table when several places change.",
  "**Decisions it rests on**: the answered questions and the design's assumptions and alternatives not taken.",
];

// Both outlines end the same way.
const BRIEFING_END = [
  "**What the plan does**: the plan steps grouped by purpose and why each is needed; name the user steps you don't do.",
  "**Risks to keep in mind**: the design's risks, open findings and unchecked assumptions.",
];

// Links the notes instead of copying them (one fact, one place); only the plan and tests are repeated, as checklists.
export function renderImplementNote(note: ImplementNote, notesSection: string): string {
  const pbi = pbiNoteName(note.adoId);

  return [
    frontmatter({
      id: implementNoteName(note.adoId),
      type: "implement",
      title: `Implement: ${note.title}`,
      status: "final",
      pbi: `[[${pbi}]]`,
      design_version: note.designVersion,
      created_by: "adoa",
      updated: isoDate(note.updated),
      tags: ["adoa", `pbi-${note.adoId}`, "implement"],
      related: [`[[${pbi}]]`, `[[${designNoteName(note.adoId)}]]`],
    }),
    `# ${implementNoteName(note.adoId)} Implement: ${note.title}`,
    `PBI: [[${pbi}]] · Design: [[${designNoteName(note.adoId)}]] v${note.designVersion}`,
    "Handoff for the Claude chat that implements this PBI (adoa's \"Continue with Claude\"). Paths are relative to this note's folder.",
    "## Start",
    startSteps(note),
    "## Read first",
    bullets(note.readFirst.map((link) => `[[${link.name}]] \`${link.path}\`: ${link.about}`)),
    "## Repos",
    "Named in the plan steps; the user adds their folders to the session.",
    bullets(note.repos),
    "## Skills",
    bullets(note.skills.map((skill) => `\`${skill.name}\`${skill.reason ? `: ${skill.reason}` : ""}`)),
    "## Plan",
    checklist(note.plan.map((step, index) => `${index + 1}. ${step.step} (${step.repo}; ${step.locations.join(", ") || "–"}): ${step.change}${step.agentDoable ? "" : " **User step: not for the chat.**"}`)),
    "## Tests",
    checklist(note.tests.map((test) => `${test.kind}: ${test.case}`)),
    "## Rules",
    bullets([
      `Done when the acceptance criteria in [[${pbi}]] and the tests above pass.`,
      "Azure DevOps is never written; nothing is pushed.",
      "This vault is rendered by adoa: read it, don't edit it.",
    ]),
    notesSection,
  ].join("\n\n");
}

function startSteps(note: ImplementNote): string {
  return [
    "1. Read every note under Read first, and the code they cite where the briefing needs it.",
    "2. Answer with a briefing for the user, in plain language, short. First say whether the PBI is a bug (it fixes wrong behaviour) or a feature (new or changed behaviour), then use that outline, in this order:",
    "   - Bug:",
    ...outline(BUG_BRIEFING),
    "   - Feature:",
    ...outline(FEATURE_BRIEFING),
    "3. End the briefing by asking: \"Implement this plan?\" Change no file before the user says yes.",
    `4. After a yes: in each repo create the branch with the \`create-branch\` skill for "#${note.adoId} ${note.title}", work through the Plan checklist, then run the Tests.`,
  ].join("\n");
}

function outline(parts: string[]): string[] {
  return [...parts, ...BRIEFING_END].map((part, index) => `     ${index + 1}. ${part}`);
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "None.";
}

function checklist(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- [ ] ${item}`).join("\n") : "None.";
}
