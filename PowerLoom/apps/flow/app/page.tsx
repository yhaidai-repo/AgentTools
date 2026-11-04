import { FlowsList } from "@/components/FlowsList";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { listFlows } from "@/lib/flows";

export const dynamic = "force-dynamic";

// The vault's flows from PowerLoom's database.
export default async function FlowsPage() {
  const vault = await currentVault();

  if (!vault) return <NoVault title="Flows" />;

  return <FlowsList flows={await listFlows(vault)} />;
}
