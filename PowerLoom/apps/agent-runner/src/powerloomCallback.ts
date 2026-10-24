import type { AgentRunResult } from "@powerloom/agents";

// PowerLoom's one callback per run (`POST /api/agent-runs/{taskId}/completed`): the run row, its outcome and the
// error when there was one. PowerLoom hands the task on, recalculates the PBI and renders its notes from there.
export type CompletedRun = { runId: number | null; outcome: AgentRunResult["outcome"] | "aborted" | "failed"; error: string | null };

export class PowerLoomCallback {
  constructor(private readonly baseUrl: string) {}

  async completed(taskId: string, run: CompletedRun): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/agent-runs/${encodeURIComponent(taskId)}/completed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(run),
    });

    if (!response.ok) {
      throw new Error(`PowerLoom didn't take the completed run of ${taskId}: ${response.status}`);
    }
  }
}
