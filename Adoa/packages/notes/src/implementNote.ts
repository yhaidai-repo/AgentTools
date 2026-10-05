import { design, localItem, workItem } from "@adoa/db";
import { designNoteName, pathInPbiFolder, pbiNoteName, planRepos, refinementNoteName, type ImplementNote, type ImplementNoteLink } from "@adoa/vault";
import { basename } from "node:path";

type WorkItemRow = typeof workItem.$inferSelect;
type DesignRow = typeof design.$inferSelect;
type ItemRow = typeof localItem.$inferSelect;

// What the chat reads besides the PBI, refinement and design: final research results, the user's answers, and the
// findings still waiting for review (the briefing's risks).
const READ_FIRST_ITEMS: Record<string, { status: string; about: string }> = {
  "research-result": { status: "final", about: "research result" },
  question: { status: "answered", about: "answered question" },
  human: { status: "done", about: "done human task" },
  finding: { status: "open", about: "open finding" },
};

export function implementNote(pbi: WorkItemRow, latestDesign: DesignRow, items: ItemRow[], pbiPath: string): ImplementNote {
  return {
    adoId: pbi.adoId,
    title: pbi.title,
    designVersion: latestDesign.version,
    updated: latestDesign.createdAt,
    readFirst: [...pipelineLinks(pbi.adoId, pbiPath), ...items.filter(isReadFirst).map((item) => itemLink(item, pbiPath))],
    repos: planRepos(latestDesign.plan),
    skills: pbi.skills.map((skill) => ({ name: skill.name, reason: skill.reason })),
    plan: latestDesign.plan,
    tests: latestDesign.tests,
  };
}

function pipelineLinks(adoId: number, pbiPath: string): ImplementNoteLink[] {
  return [
    { name: pbiNoteName(adoId), path: basename(pbiPath), about: "the PBI: description, acceptance criteria" },
    { name: refinementNoteName(adoId), path: `${refinementNoteName(adoId)}.md`, about: "refinement: scope, gaps, relevant docs" },
    { name: designNoteName(adoId), path: `${designNoteName(adoId)}.md`, about: "design: approach, risks, assumptions" },
  ];
}

function isReadFirst(item: ItemRow): boolean {
  return item.vaultPath !== null && READ_FIRST_ITEMS[item.kind]?.status === item.status;
}

function itemLink(item: ItemRow, pbiPath: string): ImplementNoteLink {
  return { name: item.id, path: pathInPbiFolder(pbiPath, item.vaultPath!), about: `${READ_FIRST_ITEMS[item.kind]!.about}: ${item.title}` };
}
