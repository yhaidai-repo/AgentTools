import { z } from "zod";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";

// The task type review agents take (an agent's `handles`).
const REVIEW_TASK_TYPE = "review";

// The user starts every review (user decision 2026-10-02): a full review of the PR's current commit, earlier comments and
// answers included. The task goes to the pool; every enabled agent taking review tasks is started now, and one claims it.
export const queueReviewCommand: Command<{ prId: number }, { message: string }> = {
  name: "review.queue",
  description: "Start a review of a pull request (or branch review) at its current commit, earlier comments and answers included: a review task for the agents taking review tasks, started now. Ask the user which review when they didn't say (review_list).",
  input: z.object({ prId: z.number().int().describe("The review's PR id (review_list)") }),
  async run(context, input) {
    const queued = await context.powerloom.queueReview(input.prId);

    if (!queued.ok) {
      return queued;
    }

    const { started, refused, available } = await startReviewers(context);
    const dispatch = started > 0 ? `${started} agent dispatch(es) accepted` : available ? "no agent dispatch was accepted" : "no enabled agent takes review tasks yet (Agents page)";
    const reasons = refused.length > 0 ? ` Refused: ${refused.join("; ")}.` : "";

    return { ok: true, value: { message: `${queued.value} queued; ${dispatch}.${reasons}` } };
  },
};

async function startReviewers(context: CommandContext): Promise<{ started: number; refused: string[]; available: number }> {
  const reviewers = ((await context.agents?.list()) ?? []).filter((agent) => agent.enabled && agent.handles.includes(REVIEW_TASK_TYPE));
  let started = 0;
  const refused: string[] = [];

  for (const agent of reviewers) {
    const result = await context.powerloom.runAgent(agent.id);
    if (result.ok) started++;
    else refused.push(`${agent.id}: ${result.error}`);
  }

  return { started, refused, available: reviewers.length };
}
