import { conversationChain, conversationCostUsd, type AgentRunRow } from "@powerloom/core";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatUsd } from "@/lib/format";
import { getUsageStore } from "@/lib/usage";

// A run that continued an earlier run's conversation, or was continued by a later one (user decision 2026-10-19): links
// both ways, and what the whole conversation cost; facts of the run header.
export async function ConversationFacts({ run }: { run: AgentRunRow }) {
  const chain = await conversationChain(getDb(), run);

  if (chain.length === 1) {
    return null;
  }

  const next = chain[chain.indexOf(run) + 1];
  const totalUsd = await conversationCostUsd(getUsageStore(), chain);

  return (
    <>
      {run.continuesRunId && <span className="fact"><b>Continues</b><Link href={`/agents/runs/${run.continuesRunId}`}>RUN-{run.continuesRunId}</Link></span>}
      {next && <span className="fact"><b>Continued by</b><Link href={`/agents/runs/${next.id}`}>RUN-{next.id}</Link></span>}
      <span className="fact"><b>Conversation</b><span className="mono">{chain.length} runs · {formatUsd(totalUsd)}</span></span>
    </>
  );
}
