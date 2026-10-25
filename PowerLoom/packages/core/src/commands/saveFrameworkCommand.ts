import { validateGlobal } from "@agenttools/config";
import { z } from "zod";
import { FRAMEWORK_ID, withFrameworkVersion } from "../agents/frameworkVersioning";
import { insertPromptVersion } from "../agents/promptVersions";
import type { Command } from "../models/Command";

// Settings → Agents: the shared framework every `{{framework}}` prompt pulls in. Every edit is a new version, kept with
// the agents' prompt history; the code's text again puts the agents back on the file.
export const saveFrameworkCommand: Command<{ text: string }, { version: number; onFile: boolean }> = {
  name: "agent.saveFramework",
  description: "Replace the shared framework: the instructions every agent prompt with {{framework}} pulls in (how agents work, the principles, next steps). Read it first with agent_global (framework, empty while the code's file applies) and show the user the change before calling. Takes effect on the next run of every such agent.",
  input: z.object({ text: z.string().min(1).describe("The whole framework in Markdown") }),
  async run(context, input) {
    const agents = context.agents;

    if (!agents) {
      return { ok: false, error: "The agents' settings can't be changed from here (no agent store)." };
    }

    const current = await agents.getGlobal();
    const checked = validateGlobal(await withFrameworkVersion(input.text, current));

    if (!checked.ok) {
      return { ok: false, error: checked.errors.join("; ") };
    }

    const version = checked.value.frameworkVersion ?? 0;

    if (version !== (current.frameworkVersion ?? 0)) {
      await insertPromptVersion(context.db, FRAMEWORK_ID, version, checked.value.framework ?? "");
    }

    await agents.saveGlobal(checked.value);

    return { ok: true, value: { version, onFile: !checked.value.framework } };
  },
};
