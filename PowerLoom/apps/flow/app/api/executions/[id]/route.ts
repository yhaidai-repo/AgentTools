import { currentVault } from "@/lib/currentVault";
import { getExecution } from "@/lib/flows";

// One execution as the page draws it; the execution page polls it while the execution runs (like web's /api/running-runs).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();
  const execution = vault ? await getExecution(decodeURIComponent((await params).id), vault) : null;

  if (!execution) {
    return Response.json({ error: "No such execution in this vault." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(execution, { headers: { "Cache-Control": "no-store" } });
}
