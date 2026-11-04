import { readFlows } from "@powerloom/core/src/flows";
import { ExecutionsList } from "@/components/ExecutionsList";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { listExecutions } from "@/lib/flows";

export const dynamic = "force-dynamic";

// The vault's executions, newest first; `?flow=<id>` narrows to one flow.
export default async function ExecutionsPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Executions" />;

  const flowId = (await searchParams).flow?.trim() || null;
  const [executions, flows] = await Promise.all([listExecutions(vault, flowId), readFlows(getDb(), vault)]);

  return <ExecutionsList executions={executions} flows={flows.map((flow) => ({ id: flow.id, name: flow.name }))} flowId={flowId} />;
}
