import { readFlows } from "@powerloom/core/src/flows";
import { ExecutionsList } from "@/components/ExecutionsList";
import { FlowTablesMissing } from "@/components/FlowTablesMissing";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { listExecutions } from "@/lib/flows";
import { unlessFlowTablesMissing } from "@/lib/flowTables";

export const dynamic = "force-dynamic";

// The vault's executions, newest first; `?flow=<id>` narrows to one flow.
export default async function ExecutionsPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Executions" />;

  const flowId = (await searchParams).flow?.trim() || null;
  const loaded = await unlessFlowTablesMissing(() => Promise.all([listExecutions(vault, flowId), readFlows(getDb(), vault)]));

  if (!loaded) return <FlowTablesMissing title="Executions" />;

  const [executions, flows] = loaded;

  return <ExecutionsList executions={executions} flows={flows.map((flow) => ({ id: flow.id, name: flow.name }))} flowId={flowId} />;
}
