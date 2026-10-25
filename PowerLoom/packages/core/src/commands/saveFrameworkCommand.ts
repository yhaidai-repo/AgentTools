import { validateGlobal } from "@agenttools/config";
import { z } from "zod";
import { FRAMEWORK_ID, withFrameworkVersion } from "../agents/frameworkVersioning";
import { readPromptFile } from "../agents/promptFiles";
import { insertPromptVersion, loadPromptVersions } from "../agents/promptVersions";
import type { Command } from "../models/Command";

// Settings → Agents: the shared framework every `{{framework}}` prompt pulls in. Every edit is a new version, kept with
// the agents' prompt history; the code's text again (or reset) puts the agents back on the file.
export const saveFrameworkCommand: Command<{ text?: string; reset?: boolean }, { version: number; onFile: boolean }> = {
  name: "agent.saveFramework",
  description: "Replace the shared framework: the instructions every agent prompt with {{framework}} pulls in (how agents work, the principles, next steps). Read the one in effect first with agent_framework and show the user the change before calling; reset puts the agents back on the code's framework (confirm that with the user first). Takes effect on the next run of every such agent.",
  input: z.object({
    text: z.string().min(1).optional().describe("The whole framework in Markdown"),
    reset: z.boolean().optional().describe("true: back on the code's framework file (no text)"),
  }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "The agents' settings can't be changed from here (no agent store)." };
    }

    if (!input.text === !input.reset) {
      return { ok: false, error: "Give either text (the whole framework) or reset: true." };
    }

    const typed = input.reset ? (await readPromptFile(FRAMEWORK_ID))?.text ?? "" : input.text ?? "";
    const current = await agents.getGlobal();
    const [latest] = await loadPromptVersions(context.db, FRAMEWORK_ID);
    const next = await withFrameworkVersion(typed, current, latest ?? null);
    const checked = validateGlobal(next.global);

    if (!checked.ok) {
      return { ok: false, error: checked.errors.join("; ") };
    }

    const version = checked.value.frameworkVersion ?? 0;

    if (next.writesHistory) {
      await insertPromptVersion(context.db, FRAMEWORK_ID, version, checked.value.framework ?? "");
    }

    await agents.saveGlobal(checked.value);

    return { ok: true, value: { version, onFile: !checked.value.framework } };
  },
};
