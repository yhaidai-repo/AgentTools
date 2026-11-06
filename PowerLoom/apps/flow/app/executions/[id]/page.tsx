import { notFound } from "next/navigation";
import { ExecutionView } from "@/components/ExecutionView";
import { FlowTablesMissing } from "@/components/FlowTablesMissing";
import { NoVault } from "@/components/NoVault";
import { loadAgentPalette } from "@/lib/agents";
import { currentVault } from "@/lib/currentVault";
import { getExecution } from "@/lib/flows";
import { unlessFlowTablesMissing } from "@/lib/flowTables";

export const dynamic = "force-dynamic";

// One execution: its canvas coloured by the steps, the step table, Cancel while it runs; polls while running.
export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Execution" />;

  const id = decodeURIComponent((await params).id);
  const loaded = await unlessFlowTablesMissing(() => Promise.all([getExecution(id, vault), loadAgentPalette()]));

  if (!loaded) return <FlowTablesMissing title={id} />;

  const [execution, palette] = loaded;

  if (!execution) notFound();

  return <ExecutionView initial={execution} agents={palette.agents} />;
}
