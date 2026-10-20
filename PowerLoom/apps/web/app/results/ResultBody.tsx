import type { refinement } from "@powerloom/db";
import { TitledList } from "@/components/TitledList";
import type { AgentResult } from "@/models/AgentResult";
import type { RefinementDetailsView } from "@/models/RefinementDetailsView";
import { ItemContent } from "../items/ItemContent";
import { DesignSection } from "../pbis/[adoId]/DesignSection";
import { EstimateLine } from "../pbis/[adoId]/EstimateLine";
import { RefinementDetailsLine } from "../pbis/[adoId]/RefinementDetailsLine";
import { ReviewBody } from "./ReviewBody";

type RefinementRow = typeof refinement.$inferSelect;

// One result version's content, laid out per kind; the result block folds it, the full page shows it whole.
export function ResultBody({ result }: { result: AgentResult }) {
  if (result.kind === "refinement") {
    return <RefinementBody row={result.row} />;
  }

  if (result.kind === "design") {
    return <DesignSection design={result.row} />;
  }

  if (result.kind === "estimate") {
    return <EstimateLine estimate={result.row} />;
  }

  if (result.kind === "review") {
    return <ReviewBody review={result.row} />;
  }

  return <ItemContent item={result.row} />;
}

function RefinementBody({ row }: { row: RefinementRow }) {
  return (
    <>
      <p>{row.summary}</p>
      <RefinementDetailsLine adoId={row.pbiId} details={row.details as RefinementDetailsView | null} />
      <TitledList title="In scope" items={row.scopeIn} />
      <TitledList title="Out of scope" items={row.scopeOut} />
      <TitledList title="Acceptance criteria gaps" items={row.acGaps.map((gap) => `${gap.gap} → ${gap.suggestion}`)} />
      <TitledList title="Dependencies" items={row.dependencies} />
      <TitledList title="Assumptions" items={row.assumptions} />
    </>
  );
}
