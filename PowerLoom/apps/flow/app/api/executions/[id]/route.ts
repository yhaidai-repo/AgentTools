import { currentVault } from "@/lib/currentVault";
import { getExecution } from "@/lib/flows";
import { isMissingFlowTables } from "@/lib/flowTables";

const NO_STORE = { "Cache-Control": "no-store" };

// One execution as the page draws it; the execution page polls it while the execution runs (like web's /api/running-runs).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();

  try {
    const execution = vault ? await getExecution(decodeURIComponent((await params).id), vault) : null;

    return execution ? Response.json(execution, { headers: NO_STORE }) : Response.json({ error: "No such execution in this vault." }, { status: 404, headers: NO_STORE });
  } catch (error) {
    if (isMissingFlowTables(error)) return Response.json({ error: "PowerLoom's database has no flow tables yet." }, { status: 503, headers: NO_STORE });
    throw error;
  }
}
