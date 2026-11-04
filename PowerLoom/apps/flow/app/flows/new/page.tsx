import { FlowEditor } from "@/components/FlowEditor";
import { NoVault } from "@/components/NoVault";
import { loadAgentPalette } from "@/lib/agents";
import { currentVault } from "@/lib/currentVault";

export const dynamic = "force-dynamic";

// A new flow: the trigger node and the palette; the first Save creates it and opens its own page.
export default async function NewFlowPage() {
  const vault = await currentVault();

  if (!vault) return <NoVault title="New flow" />;

  return <FlowEditor flow={null} palette={await loadAgentPalette()} />;
}
