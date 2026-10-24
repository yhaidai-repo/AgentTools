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

    const started = await startReviewers(context);

    return { ok: true, value: { message: `${queued.value} queued; ${started > 0 ? "it starts now" : "no enabled agent takes review tasks yet (Agents page)"}.` } };
  },
};

async function startReviewers(context: CommandContext): Promise<number> {
  const reviewers = ((await context.agents?.list()) ?? []).filter((agent) => agent.enabled && agent.handles.includes(REVIEW_TASK_TYPE));

  for (const agent of reviewers) {
    await context.powerloom.runAgent(agent.id);
  }

  return reviewers.length;
}
