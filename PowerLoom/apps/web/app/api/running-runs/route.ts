import { currentVault } from "@/lib/currentVault";
import { loadRunningRunIds } from "@/lib/runningRuns";

// The ids of the runs in progress in the selected vault; RunWatch polls it.
export async function GET() {
  const vault = await currentVault();

  return Response.json({ ids: vault ? await loadRunningRunIds(vault) : [] }, { headers: { "Cache-Control": "no-store" } });
}
