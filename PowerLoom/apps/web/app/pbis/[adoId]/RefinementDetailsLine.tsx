import Link from "next/link";
import type { RefinementDetailsView } from "@/models/RefinementDetailsView";

// Better Refinement's verdict at a glance: its status, what still blocks the PBI (each with the task resolving it) and
// the test data it lacks; the refinement note has the rest. Earlier refinements have no details and show nothing.
export function RefinementDetailsLine({ adoId, details }: { adoId: number; details: RefinementDetailsView | null }) {
  if (!details) {
    return null;
  }

  const missing = details.testData.applicable ? details.testData.missing.length : 0;

  return (
    <p className="muted">
      {details.status} · {details.affectedAreas.length} affected area(s) · {missing > 0 ? `${missing} test data item(s) missing` : "test data complete or not needed"}
      {details.blockers.map((blocker) => (
        <span key={`${blocker.resolvedBy}-${blocker.what}`}>
          {" · blocked: "}{blocker.what} (<Link href={`/pbis/${adoId}/items/${blocker.resolvedBy}`}>{blocker.resolvedBy}</Link>)
        </span>
      ))}
    </p>
  );
}
