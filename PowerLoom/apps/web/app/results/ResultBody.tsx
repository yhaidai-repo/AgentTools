import type { refinement } from "@powerloom/db";
import { TitledList } from "@/components/TitledList";
import type { AgentResult } from "@/models/AgentResult";
import type { ResultQuestion } from "@/models/ResultQuestion";
import type { RefinementDetailsView } from "@/models/RefinementDetailsView";
import { ItemContent } from "../items/ItemContent";
import { DesignSection } from "../pbis/[adoId]/DesignSection";
import { EstimateLine } from "../pbis/[adoId]/EstimateLine";
import { RefinementDetailsLine } from "../pbis/[adoId]/RefinementDetailsLine";
import { ReviewBody } from "./ReviewBody";

type RefinementRow = typeof refinement.$inferSelect;

// One result version's content, laid out per kind; the result block folds it, the full page shows it whole. A research
// result starts with the question it answers, unless its own task's page already shows it (withQuestion false).
export function ResultBody({ result, withQuestion = true }: { result: AgentResult; withQuestion?: boolean }) {
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

  return (
    <>
      {withQuestion && result.question && <QuestionLine question={result.question} />}
      <ItemContent item={result.row} />
    </>
  );
}

function QuestionLine({ question }: { question: ResultQuestion }) {
  return (
    <div className="result-question">
      <p><strong>Question:</strong> {question.question}</p>
      {question.goal && <p><strong>Goal:</strong> {question.goal}</p>}
    </div>
  );
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
