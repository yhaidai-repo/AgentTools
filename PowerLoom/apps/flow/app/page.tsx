import { FlowTablesMissing } from "@/components/FlowTablesMissing";
import { FlowsList } from "@/components/FlowsList";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { listFlows } from "@/lib/flows";
import { unlessFlowTablesMissing } from "@/lib/flowTables";

export const dynamic = "force-dynamic";

// The vault's flows from PowerLoom's database.
export default async function FlowsPage() {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Flows" />;

  const flows = await unlessFlowTablesMissing(() => listFlows(vault));

  if (!flows) return <FlowTablesMissing title="Flows" />;

  return <FlowsList flows={flows} />;
}
