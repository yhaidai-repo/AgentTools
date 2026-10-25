import { loadRunExport } from "@powerloom/core";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { getUsageStore } from "@/lib/usage";

// "Download" on the run page: the whole run as RUN-<id>.json (its input, outcome, task, usage, uncut trace and what was
// logged about it), to save and share instead of screenshots. A run of another vault is not found, as on its page.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vault = await currentVault();
  const runId = Number((await params).id);
  const exported = vault && Number.isInteger(runId) ? await loadRunExport(getDb(), getUsageStore(), runId, vault) : null;

  if (!exported) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="RUN-${runId}.json"`,
    },
  });
}
