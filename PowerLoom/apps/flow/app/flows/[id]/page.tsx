import { readFlowExecutions } from "@powerloom/core/src/flows";
import { notFound } from "next/navigation";
import { FlowEditor } from "@/components/FlowEditor";
import { FlowTablesMissing } from "@/components/FlowTablesMissing";
import { NoVault } from "@/components/NoVault";
import { loadAgentPalette } from "@/lib/agents";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { getFlow } from "@/lib/flows";
import { unlessFlowTablesMissing } from "@/lib/flowTables";

export const dynamic = "force-dynamic";

// The editor of a saved flow: the agents and the flow come from the database at request time.
export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Flow" />;

  const id = decodeURIComponent((await params).id);
  const loaded = await unlessFlowTablesMissing(() => Promise.all([getFlow(id, vault), loadAgentPalette(), readFlowExecutions(getDb(), vault, { flowId: id, limit: 500 })]));

  if (!loaded) return <FlowTablesMissing title={id} />;

  const [flow, palette, executions] = loaded;

  if (!flow) notFound();

  return <FlowEditor flow={{ id: flow.id, name: flow.name, version: flow.version, updatedAt: flow.updatedAt.toISOString(), definition: flow.definition, executions: executions.length }} palette={palette} />;
}
