import { z } from "zod";
import { runRef } from "../agentRuns/vaultRuns";
import { ALL_FAILURE_AGENTS, loadFailureReportGroups, loadRecentFailureReports } from "../failureReports/failureReportSummary";
import type { Command } from "../models/Command";
import type { FailureReportGroup } from "../models/FailureReportGroup";
import { periodStart } from "../periods";
import { limitInput, periodInput, vaultInput } from "./inputs";

const input = z.object({
  vault: vaultInput,
  period: periodInput,
  agent: z.string().trim().min(1).optional().describe("Only this agent's reports (its id; 'chat' for chats); every reporter when left out"),
  limit: limitInput(200, 30),
});

type ListFailureReportsInput = z.infer<typeof input>;

interface RecentReport {
  id: string;
  at: Date;
  origin: string;
  agentId: string;
  run: string | null;
  kind: string;
  tool: string | null;
  target: string;
  saw: string;
  workaround: string;
  instead: string | null;
  impact: string;
}

// The failures agents and chats reported, as the Tools tab's "Reported by agents" section shows them.
export const listFailureReportsCommand: Command<ListFailureReportsInput, { groups: FailureReportGroup[]; recent: RecentReport[] }> = {
  name: "failure.reports",
  effect: "read",
  description: "List the failures agents and chats reported in a period: the causes reported most (kind, tool, target, how many reports and runs, which agents, last report) and the latest reports with what the reporter saw, what it did instead and the impact on its result. These are the reporters' claims; the data access log (access_list) shows the failed calls themselves. Filter by agent id.",
  input,
  async run(context, input) {
    const since = await periodStart(context.db, input.period, input.vault);
    const agent = input.agent ?? ALL_FAILURE_AGENTS;
    const groups = await loadFailureReportGroups(context.db, input.vault, since, agent);
    const recent = await loadRecentFailureReports(context.db, input.vault, since, agent, input.limit);

    return { ok: true, value: { groups: groups.slice(0, input.limit), recent: recent.map((row) => ({ id: `FR-${row.id}`, at: row.createdAt, origin: row.origin, agentId: row.agentId, run: row.runId === null ? null : runRef(row.runId), kind: row.kind, tool: row.tool, target: row.target, saw: row.saw, workaround: row.workaround, instead: row.instead, impact: row.impact })) } };
  },
};
