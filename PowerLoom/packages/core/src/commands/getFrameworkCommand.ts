import { z } from "zod";
import { FRAMEWORK_ID } from "../agents/frameworkVersioning";
import { readPromptFile } from "../agents/promptFiles";
import { loadPromptVersions } from "../agents/promptVersions";
import type { Command } from "../models/Command";

interface FrameworkView {
  /** settings: edited in Settings → Agents; file: the code's _framework.md. */
  source: "settings" | "file";
  /** As runs record it: ui-v<N> for the stored one, the file's v<N> otherwise. */
  version: string;
  text: string;
  fileVersion: string | null;
  /** The saved versions, newest first; one in full with `version`. */
  history: { version: number; savedAt: string }[];
}

// The framework the agents run on now, where it comes from, and its saved versions (agent.saveFramework changes it).
export const getFrameworkCommand: Command<{ version?: number }, FrameworkView> = {
  name: "agent.framework",
  effect: "read",
  description: "Read the shared framework the agents run on now (every agent prompt with {{framework}} pulls it in): its text, whether it is the code's file or the version edited in Settings, the file's version and the saved versions. With version, the text is that saved version's. agent_saveFramework changes it.",
  input: z.object({ version: z.number().int().positive().optional().describe("A saved version to read instead of the one in effect") }),
  async run(context, input) {
    if (!context.agents) {
      return { ok: false, error: "Agent definitions aren't available here." };
    }

    const global = await context.agents.getGlobal();
    const file = await readPromptFile(FRAMEWORK_ID);
    const versions = await loadPromptVersions(context.db, FRAMEWORK_ID);
    const history = versions.map((row) => ({ version: row.version, savedAt: row.createdAt.toISOString() }));
    const stored = (global.framework ?? "").trim();

    if (input.version !== undefined) {
      const saved = versions.find((row) => row.version === input.version);

      return saved ? { ok: true, value: { source: "settings", version: `ui-v${saved.version}`, text: saved.text, fileVersion: file?.version ?? null, history } } : { ok: false, error: `No saved framework version ${input.version}; history lists the saved ones.` };
    }

    if (stored) {
      return { ok: true, value: { source: "settings", version: `ui-v${global.frameworkVersion ?? 0}`, text: stored, fileVersion: file?.version ?? null, history } };
    }

    return { ok: true, value: { source: "file", version: file?.version ?? "none", text: file?.text ?? "", fileVersion: file?.version ?? null, history } };
  },
};
