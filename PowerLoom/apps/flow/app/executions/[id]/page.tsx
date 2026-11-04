import { notFound } from "next/navigation";
import { ExecutionView } from "@/components/ExecutionView";
import { NoVault } from "@/components/NoVault";
import { loadAgentPalette } from "@/lib/agents";
import { currentVault } from "@/lib/currentVault";
import { getExecution } from "@/lib/flows";

export const dynamic = "force-dynamic";

// One execution: its canvas coloured by the steps, the step table, Cancel while it runs; polls while running.
export default async function ExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Execution" />;

  const [execution, palette] = await Promise.all([getExecution(decodeURIComponent((await params).id), vault), loadAgentPalette()]);

  if (!execution) notFound();

  return <ExecutionView initial={execution} agents={palette.agents} />;
}
