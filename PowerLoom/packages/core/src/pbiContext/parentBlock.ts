import { readBug } from "../bugs/bugRecords";
import { design, refinement, workItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";

type WorkItemRow = typeof workItem.$inferSelect;
type DesignRow = typeof design.$inferSelect;

const BUG_ORIGINS: Record<string, string> = { ado: "reported by QA in Azure DevOps", internal: "reported in PowerLoom after design" };

// A child item's agents work from its parent's context (user decision 2026-10-09): the parent PBI, its refinement and
// its design, so a bug is fixed inside the parent's design instead of re-designing the parent. Empty for a top-level PBI.
export async function parentBlock(db: PowerLoomDb, row: WorkItemRow): Promise<string> {
  if (row.parentId === null) {
    return "";
  }

  const [parent] = await db.select().from(workItem).where(eq(workItem.adoId, row.parentId));

  if (!parent) {
    return "";
  }

  const [latestRefinement] = await db.select().from(refinement).where(eq(refinement.pbiId, parent.adoId)).orderBy(desc(refinement.version)).limit(1);
  const [latestDesign] = await db.select().from(design).where(eq(design.pbiId, parent.adoId)).orderBy(desc(design.version)).limit(1);

  return [
    `<parent-pbi id="${parent.adoId}">`,
    `This item is a child of PBI-${parent.adoId} and is worked on the parent's branch. Fix it inside the parent's design; don't re-design the parent.`,
    await bugLine(db, row.adoId),
    `Title: ${parent.title} (ADO state ${parent.adoState}, pipeline ${parent.pipelineStatus})`,
    `Description:\n${parent.descriptionMd?.trim() || "-"}`,
    `Acceptance criteria:\n${parent.acceptanceCriteriaMd?.trim() || "-"}`,
    latestRefinement ? `Refinement v${latestRefinement.version}: ${latestRefinement.summary}` : "Refinement: none",
    latestDesign ? designLines(latestDesign) : "Design: none",
    "</parent-pbi>",
  ].join("\n");
}

async function bugLine(db: PowerLoomDb, adoId: number): Promise<string> {
  const bug = await readBug(db, adoId);

  return bug ? `It is a bug ${BUG_ORIGINS[bug.source]}, found when the parent was ${bug.foundIn}.` : "It is a child item, not a bug.";
}

function designLines(latest: DesignRow): string {
  const steps = latest.plan.map((step) => `- [${step.repo}] ${step.step}: ${step.change} (${step.locations.join(", ") || "-"})`);

  return [`Design v${latest.version}: ${latest.approach || "-"}`, "Plan:", ...(steps.length > 0 ? steps : ["- none"])].join("\n");
}
