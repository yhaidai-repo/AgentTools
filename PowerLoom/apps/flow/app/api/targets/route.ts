import { currentVault } from "@/lib/currentVault";
import { loadRunTargets } from "@/lib/targets";

// The vault's PBIs and open tasks for the Run dialog, read when it opens.
export async function GET() {
  const vault = await currentVault();
  const targets = vault ? await loadRunTargets(vault) : { pbis: [], tasks: [] };

  return Response.json(targets, { headers: { "Cache-Control": "no-store" } });
}
