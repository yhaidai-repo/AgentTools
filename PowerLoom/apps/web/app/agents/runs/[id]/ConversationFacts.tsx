import { agentRun } from "@powerloom/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatUsd } from "@/lib/format";
import { getUsageStore } from "@/lib/usage";

type RunRow = typeof agentRun.$inferSelect;

// A guard only: a task's chain ends at its agent's maxFailures or a budget stop long before this.
const MAX_CHAIN = 50;

// A run that continued an earlier run's conversation, or was continued by a later one (user decision 2026-10-19): links
// both ways, and what the whole conversation cost; facts of the run header.
export async function ConversationFacts({ run }: { run: RunRow }) {
  const chain = [...(await earlierRuns(run)), run, ...(await laterRuns(run))];

  if (chain.length === 1) {
    return null;
  }

  const next = chain[chain.indexOf(run) + 1];
  const totalUsd = await chainCostUsd(chain);

  return (
    <>
      {run.continuesRunId && <span className="fact"><b>Continues</b><Link href={`/agents/runs/${run.continuesRunId}`}>RUN-{run.continuesRunId}</Link></span>}
      {next && <span className="fact"><b>Continued by</b><Link href={`/agents/runs/${next.id}`}>RUN-{next.id}</Link></span>}
      <span className="fact"><b>Conversation</b><span className="mono">{chain.length} runs · {formatUsd(totalUsd)}</span></span>
    </>
  );
}

async function earlierRuns(run: RunRow): Promise<RunRow[]> {
  const runs: RunRow[] = [];
  let id = run.continuesRunId;

  while (id !== null && runs.length < MAX_CHAIN) {
    const [earlier] = await getDb().select().from(agentRun).where(eq(agentRun.id, id));

    runs.unshift(...(earlier ? [earlier] : []));
    id = earlier?.continuesRunId ?? null;
  }

  return runs;
}

async function laterRuns(run: RunRow): Promise<RunRow[]> {
  const runs: RunRow[] = [];
  let id: number | null = run.id;

  while (id !== null && runs.length < MAX_CHAIN) {
    const [later] = await getDb().select().from(agentRun).where(eq(agentRun.continuesRunId, id));

    runs.push(...(later ? [later] : []));
    id = later?.id ?? null;
  }

  return runs;
}

async function chainCostUsd(chain: RunRow[]): Promise<number> {
  const store = getUsageStore();
  const records = await Promise.all(chain.map((run) => store.records({ from: new Date(0), match: { run: String(run.id) } }, 1)));

  return records.reduce((sum, [record]) => sum + (record?.costUsd ?? 0), 0);
}
