import { design, workItem } from "@adoa/db";
import { implementNotePath, planRepos } from "@adoa/vault";
import { desc, eq } from "drizzle-orm";
import type { ChatPlan } from "../models/ChatPlan";
import type { CommandContext } from "../models/CommandContext";
import type { ContinueEnv } from "../models/ContinueEnv";
import type { Outcome } from "../models/Outcome";
import type { PbiJob } from "../models/PbiJob";
import type { PipelineStatus } from "../models/PipelineStatus";
import { setPbiStatus } from "../pbiStatus";
import { PBI_QUEUE } from "../queues";
import { backlogHostPath, repoHostPaths } from "./hostPaths";
import { renderedNoteProblem } from "./renderedNote";

// The statuses a PBI is implemented from; its handoff note exists only then. The first chat moves ready-for-dev → development.
export const IMPLEMENTABLE: PipelineStatus[] = ["ready-for-dev", "development"];

// The PBI's chat implements the design's plan: it adds the plan's repos (user decision 2026-10-05), then follows the
// handoff note's Start section: a briefing, and code changes only after the user's yes.
export async function pbiChatPlan(env: ContinueEnv, context: CommandContext, adoId: number): Promise<Outcome<ChatPlan>> {
  const [pbi] = await context.db.select().from(workItem).where(eq(workItem.adoId, adoId));
  const [latest] = await context.db.select({ plan: design.plan }).from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);

  if (!pbi || !latest || !pbi.vaultPath) {
    return { ok: false, error: "Needs the PBI's note and a design first." };
  }

  const repos = planRepos(latest.plan);
  const problem = readinessProblem(pbi.pipelineStatus, repos);

  if (problem) {
    return { ok: false, error: problem };
  }

  const notePath = implementNotePath(pbi.vaultPath, adoId);
  const request = {
    title: `Implement PBI-${adoId}: ${pbi.title}`,
    intro: [],
    folder: env.folder,
    repoFolders: repoHostPaths(env, repos),
    steps: [`Read ${backlogHostPath(env, notePath)} and follow its Start section: brief me first, and ask before you change anything.`],
  };

  return { ok: true, value: { request, prepare: (preparing) => preparePbiChat(preparing, adoId, pbi.pipelineStatus, notePath) } };
}

function readinessProblem(status: PipelineStatus, repos: string[]): string | null {
  if (!IMPLEMENTABLE.includes(status)) {
    return `Not ready for dev yet (pipeline: ${status}).`;
  }

  return repos.length === 0 ? "The design's plan names no repo." : null;
}

async function preparePbiChat(context: CommandContext, adoId: number, status: PipelineStatus, notePath: string): Promise<string | null> {
  const refresh: PbiJob = { action: "refresh", adoId };

  if (status === "ready-for-dev") {
    await setPbiStatus(context.db, adoId, "ready-for-dev", "development", context.actor);
  }

  return renderedNoteProblem(context, PBI_QUEUE, refresh, notePath);
}
