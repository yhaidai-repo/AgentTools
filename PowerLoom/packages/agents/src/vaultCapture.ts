import { vaultCapture, type PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { CaptureDraft } from "./models/CaptureDraft";
import type { CaptureRules } from "./models/CaptureRules";

const RULES_FILE = "vault-rules.json";
const SECTION_OVERHEAD_LINES = 14;

// Reads the rules from the VaultCapture module, so the agent sees exactly what the module will enforce.
export async function loadCaptureRules(moduleHome: string | undefined): Promise<CaptureRules | null> {
  if (!moduleHome) {
    return null;
  }

  return JSON.parse(await readFile(join(moduleHome, RULES_FILE), "utf8")) as CaptureRules;
}

// vault_capture: the agent's request is checked here against the module's rules (so it can fix it at once),
// kept in memory, stored only if the run succeeds, and saved by the worker through the VaultCapture module.
export function createVaultCaptureTool(captures: CaptureDraft[], rules: CaptureRules): ToolDefinition<any> {
  return defineTool({
    name: "vault_capture",
    description: [
      "Save durable facts about the system that you verified in this run and the docs vault lacks. They become an unverified draft note in the docs vault's draft/ folder, for a person to verify and merge.",
      "Rules of the docs vault (enforced):",
      ...rules.guidance.map((rule) => `- ${rule}`),
      "Use the same name again to add bullets to your earlier draft on that topic.",
    ].join("\n"),
    input: {
      name: z.string().describe("Note name: kebab-case, starting with the project key, e.g. 'shop-order-returns-delta'"),
      title: z.string().min(1),
      project: z.string().min(1).describe("Docs vault project key (top-level folder with a <key>-index note), e.g. shop or crm"),
      target: z.string().min(1).describe("Where the facts belong once verified: '[[note]]' or a folder like 'shop/orders'"),
      captured: z.array(z.string()).min(1).describe("One fact per bullet; cite symbols, not line numbers; [[note]] links, never .md paths"),
      assumptions: z.array(z.string()).default([]),
      to_fill: z.array(z.string()).default([]).describe("What still needs checking"),
    },
    handler: async (input) => {
      const draft: CaptureDraft = { name: input.name, title: input.title, project: input.project, target: input.target, captured: input.captured, assumptions: input.assumptions, toFill: input.to_fill };
      const problems = checkCapture(draft, rules);

      if (problems.length > 0) {
        return { text: `Not saved, fix and retry: ${problems.join(" ")}`, isError: true };
      }

      captures.push(draft);

      return { text: `Capture "${draft.name}" noted; saved to draft/ if the run succeeds.` };
    },
    replayOnResume: true,
  });
}

export async function commitCaptures(db: PowerLoomDb, runId: number, pbiId: number, itemId: string | null, captures: CaptureDraft[]): Promise<string[]> {
  if (captures.length === 0) {
    return [];
  }

  const rows = await db
    .insert(vaultCapture)
    .values(captures.map((capture) => ({ runId, pbiId, itemId, ...capture })))
    .returning({ id: vaultCapture.id });

  return rows.map((row) => `CAP-${row.id}`);
}

function checkCapture(draft: CaptureDraft, rules: CaptureRules): string[] {
  const texts = [draft.title, draft.target, ...draft.captured, ...draft.assumptions, ...draft.toFill];
  const notePaths = texts.flatMap((text) => text.match(new RegExp(rules.draft.notePathPattern, "g")) ?? []);
  const lines = SECTION_OVERHEAD_LINES + draft.captured.length + draft.assumptions.length + draft.toFill.length;
  const checks: [boolean, string][] = [
    [new RegExp(rules.draft.namePattern).test(draft.name), "name must be kebab-case."],
    [draft.name.startsWith(`${draft.project}-`), `name must start with the project key "${draft.project}-".`],
    [/^\[\[[^\]]+\]\]$/.test(draft.target) || !draft.target.endsWith(".md"), "target must be a [[note]] link or a folder."],
    [notePaths.length === 0, `use [[note]] links instead of file paths: ${notePaths.join(", ")}.`],
    [lines <= rules.draft.maxLines, `too long for one draft (max ${rules.draft.maxLines} lines); split the topic.`],
  ];

  return checks.filter(([passed]) => !passed).map(([, message]) => message);
}
