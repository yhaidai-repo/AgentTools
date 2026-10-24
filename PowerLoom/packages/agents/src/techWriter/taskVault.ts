import type { localItem } from "@powerloom/db";
import { join } from "node:path";
import type { AgentDeps } from "../models/AgentDeps";
import type { ActualizeTaskData } from "./models/ActualizeTaskData";
import type { RequestTaskData } from "./models/RequestTaskData";
import type { TaskVault } from "./models/TaskVault";

type ItemRow = typeof localItem.$inferSelect;

export type TechWriterMode = "draft" | "actualize" | "request";

export function modeOf(task: ItemRow): TechWriterMode {
  const mode = (task.data as { mode?: string } | null)?.mode;

  return mode === "actualize" || mode === "request" ? mode : "draft";
}

// The vault one tech-writer task works in: the docs vault for drafts, the note's vault for actualize and request tasks.
export function taskVault(deps: AgentDeps, task: ItemRow): TaskVault {
  return modeOf(task) === "draft" ? draftVault(deps) : noteVault(deps, (task.data as ActualizeTaskData | RequestTaskData).vault);
}

// Drafts live in the task's vault (the run's; mounted writable, and VaultWriter keeps every path inside it).
function draftVault(deps: AgentDeps): TaskVault {
  if (!deps.docsVault) {
    throw new Error(`${deps.docsVaultName} isn't writable for the agent-runner (its mount)`);
  }

  return { name: deps.docsVaultName, root: deps.docsRoot, writer: deps.docsVault, isDocsVault: true };
}

// A task's own vault, read through the docs root when it is the docs vault, so reads still reach its usage log.
export function noteVault(deps: AgentDeps, vault: string): TaskVault {
  if (!deps.vaults) {
    throw new Error("the vaults root isn't mounted for the agent-runner (VAULTS_DIR)");
  }

  const isDocsVault = vault === deps.docsVaultName;

  return { name: vault, root: isDocsVault ? deps.docsRoot : join(deps.vaults.root, vault), writer: deps.vaults.writer(vault), isDocsVault };
}
