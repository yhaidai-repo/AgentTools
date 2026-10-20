import { itemPath } from "@/lib/items";
import type { ItemDetail } from "@/lib/pbiDetail";
import { versionKey } from "@/lib/resultLinks";
import { loadTaskResultSets } from "@/lib/resultVersions";
import type { ResultVersion } from "@/models/ResultVersion";
import { ResultBlock } from "../results/ResultBlock";

// What this task's runs wrote, one block per result with its versions behind a picker (user decision 2026-10-21):
// research results and test reports answering it, the refinement or design versions and the estimates of its runs.
export async function TaskResultSets({ detail, chosen }: { detail: ItemDetail; chosen: string | undefined }) {
  const { item } = detail;
  const sets = await loadTaskResultSets(item, detail.runs.map((run) => run.id));

  if (sets.length === 0) {
    return isAwaitingResult(detail) ? <p className="muted">No result yet.</p> : null;
  }

  const hrefOf = (version: ResultVersion) => `${itemPath(item)}?v=${encodeURIComponent(versionKey(version))}`;

  return (
    <>
      {sets.map((set) => (
        <section key={set.key} className="card result-section">
          <h2>{set.title}</h2>
          <ResultBlock set={set} chosen={chosen} hrefOf={hrefOf} />
        </section>
      ))}
    </>
  );
}

// A research or test task answers with result items; until one exists (and without a goal's resolution) it has none.
function isAwaitingResult(detail: ItemDetail): boolean {
  return (detail.item.kind === "research" || detail.item.kind === "test") && !detail.item.resolution;
}
