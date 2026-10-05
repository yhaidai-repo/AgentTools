import { isLinkEditable, isProtectedNote, linkKey, type VaultIndex } from "@adoa/vault";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { LinkFix } from "./models/LinkFix";
import type { ReviewDecision } from "./models/ReviewDecision";
import type { ReviewLimits } from "./models/ReviewLimits";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import { linksLeftToRemoved, plannedChanges } from "./reviewChanges";
import type { ReviewScope } from "./ReviewScope";

const vaultInput = z.string().min(1).describe("Vault folder name, one of the run's vaults");
const pathInput = z.string().min(1).describe("Note path relative to the vault root");
const reasonsInput = z.string().min(1).describe("Why, in 1-3 lines, with the evidence (what you checked)");

type ToolText = { text: string; isError?: boolean };

// The vault review's actions (user decision 2026-10-03). They only fill the draft; nothing is written until the run
// succeeds. A second call for the same note (or link) replaces the first.
export function createVaultReviewActionTools(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits): ToolDefinition<any>[] {
  return [
    decisionTool(scope, draft, limits, "keep", "keep_note", "Keep a note: it is still true and needed, only rarely read. An orphan note should also get a link from its feature or project index (fix_link can't add links: say so in the summary)."),
    decisionTool(scope, draft, limits, "remove", "remove_note", "Remove a note: its subject is gone, or other notes already hold every fact. It moves to the vault's .trash/ (restorable). Every link to it must be repointed or dropped with fix_link in this run."),
    actualizeTool(scope, draft, limits),
    fixLinkTool(scope, draft, limits),
    summaryTool(scope, draft),
  ];
}

function decisionTool(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits, action: "keep" | "remove", name: string, description: string) {
  return defineTool({
    name,
    description,
    input: { vault: vaultInput, path: pathInput, reasons: reasonsInput },
    handler: async (input) => decide(scope, draft, limits, { ...input, action, suspectFacts: [] }),
  });
}

function actualizeTool(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits) {
  return defineTool({
    name: "request_actualization",
    description: "The note's subject still exists but its facts drifted (a symbol is gone, the code changed since verified_against). The tech-writer gets a task to re-verify and rewrite it; the note is marked status: needs-review.",
    input: {
      vault: vaultInput,
      path: pathInput,
      reasons: reasonsInput,
      suspectFacts: z.array(z.string()).default([]).describe("The facts that look wrong, with what you found instead"),
    },
    handler: async (input) => decide(scope, draft, limits, { ...input, action: "actualize" }),
  });
}

function fixLinkTool(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits) {
  return defineTool({
    name: "fix_link",
    description: "Repoint a link to the right note, or drop it (to = null: the link becomes plain text, its label or target). For dead links, and links whose target no longer means what the link's line says.",
    input: {
      vault: vaultInput,
      path: pathInput.describe("The note holding the link"),
      target: z.string().min(1).describe("The link target as written, e.g. old-note for [[old-note|Label]]"),
      to: z.string().min(1).nullable().describe("The note to point at (its name, e.g. new-note), or null to drop the link"),
      reason: z.string().min(1),
    },
    handler: async (input) => inNote(scope, input.vault, input.path, (index) => stageLinkFix(index, draft, limits, input)),
  });
}

function summaryTool(scope: ReviewScope, draft: VaultReviewDraft) {
  return defineTool({
    name: "write_review_summary",
    description: "Required, last: one line per decision and link fix, plus what is left for the next run. Refused while a removed note still has links.",
    input: { summary: z.string().min(1) },
    handler: async (input) => {
      const left = await leftoverLinks(scope, draft);

      if (left.length > 0) {
        return { text: `Not saved: these links still point at notes you remove; fix them with fix_link (or keep the note), then call again:\n${left.join("\n")}`, isError: true };
      }

      draft.summary = input.summary;

      return { text: "Summary saved. Stop now; the actions are applied when the run ends." };
    },
  });
}

async function decide(scope: ReviewScope, draft: VaultReviewDraft, limits: ReviewLimits, decision: ReviewDecision): Promise<ToolText> {
  return inNote(scope, decision.vault, decision.path, (index) => {
    const problem = decisionProblem(index, draft, limits, decision);

    if (problem) {
      return { text: `Not noted: ${problem}`, isError: true };
    }

    draft.decisions = [...draft.decisions.filter((other) => !isSameNote(other, decision)), decision];

    return { text: `${decision.action} ${decision.path} noted (${draft.decisions.length} of ${limits.maxNotesPerRun} decisions).${linksToFix(index, decision)}` };
  });
}

function decisionProblem(index: VaultIndex, draft: VaultReviewDraft, limits: ReviewLimits, decision: ReviewDecision): string | null {
  if (isProtectedNote(decision.path)) {
    return `${decision.path} is protected (root file, draft or the project's own index/register); the review never decides on it.`;
  }

  const isNew = !draft.decisions.some((other) => isSameNote(other, decision));

  if (isNew && draft.decisions.length >= limits.maxNotesPerRun) {
    return `this run's cap of ${limits.maxNotesPerRun} decisions is reached; write the summary, the next run goes on.`;
  }

  const lockedBy = index.linksTo(decision.path).filter((link) => !isLinkEditable(link.from)).map((link) => link.from);

  return decision.action === "remove" && lockedBy.length > 0 ? `${lockedBy.join(", ")} link it and can't be edited; keep the note.` : null;
}

// After a remove: the links the agent still has to fix in this run.
function linksToFix(index: VaultIndex, decision: ReviewDecision): string {
  if (decision.action !== "remove") {
    return "";
  }

  const links = index.linksTo(decision.path).map((link) => `${link.from}:${link.line} [[${link.target}]]`);

  return links.length > 0 ? ` Repoint or drop these links with fix_link: ${links.join(", ")}` : "";
}

function stageLinkFix(index: VaultIndex, draft: VaultReviewDraft, limits: ReviewLimits, fix: LinkFix): ToolText {
  const problem = linkFixProblem(index, draft, limits, fix);

  if (problem) {
    return { text: `Not noted: ${problem}`, isError: true };
  }

  draft.linkFixes = [...draft.linkFixes.filter((other) => !isSameLink(other, fix)), fix];

  return { text: `${fix.path}: [[${fix.target}]] → ${fix.to === null ? "plain text" : `[[${fix.to}]]`} noted (${draft.linkFixes.length} of ${limits.maxLinkFixesPerRun} link fixes).` };
}

function linkFixProblem(index: VaultIndex, draft: VaultReviewDraft, limits: ReviewLimits, fix: LinkFix): string | null {
  if (!isLinkEditable(fix.path)) {
    return `${fix.path} is a root file or a draft; its links aren't the review's to change.`;
  }

  if (!index.linksFrom(fix.path).some((link) => linkKey(link.target) === linkKey(fix.target))) {
    return `${fix.path} has no link to [[${fix.target}]]; list_links shows its links as written.`;
  }

  const isNew = !draft.linkFixes.some((other) => isSameLink(other, fix));

  if (isNew && draft.linkFixes.length >= limits.maxLinkFixesPerRun) {
    return `this run's cap of ${limits.maxLinkFixesPerRun} link fixes is reached; write the summary, the next run goes on.`;
  }

  return fix.to === null ? null : newTargetProblem(index, draft, fix);
}

function newTargetProblem(index: VaultIndex, draft: VaultReviewDraft, fix: LinkFix): string | null {
  const resolved = index.resolve(fix.to!);

  if (!resolved) {
    return `[[${fix.to}]] is no file of ${fix.vault}; list_notes shows the names.`;
  }

  const isRemoved = draft.decisions.some((decision) => decision.vault === fix.vault && decision.path === resolved && decision.action === "remove");

  return isRemoved ? `${resolved} is removed in this run; point the link elsewhere.` : null;
}

async function leftoverLinks(scope: ReviewScope, draft: VaultReviewDraft): Promise<string[]> {
  const vaults = [...new Set(draft.decisions.filter((decision) => decision.action === "remove").map((decision) => decision.vault))];
  const perVault = await Promise.all(vaults.map(async (vault) => {
    const index = await scope.index(vault);

    return linksLeftToRemoved(index, plannedChanges(index, draft)).map((link) => `${vault}/${link.from}:${link.line} [[${link.target}]]`);
  }));

  return perVault.flat();
}

async function inNote(scope: ReviewScope, vault: string, path: string, work: (index: VaultIndex) => ToolText): Promise<ToolText> {
  if (!scope.hasVault(vault)) {
    return { text: `Unknown vault "${vault}"; this run reviews: ${scope.vaults.join(", ")}.`, isError: true };
  }

  const index = await scope.index(vault);

  return index.note(path) ? work(index) : { text: `No note "${path}" in ${vault}; list_notes shows the paths.`, isError: true };
}

function isSameNote(a: ReviewDecision, b: ReviewDecision): boolean {
  return a.vault === b.vault && a.path === b.path;
}

function isSameLink(a: LinkFix, b: LinkFix): boolean {
  return a.vault === b.vault && a.path === b.path && linkKey(a.target) === linkKey(b.target);
}
