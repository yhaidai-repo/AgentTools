import type { AutotestDraft } from "./models/AutotestDraft";
import { renderBug } from "./bugTool";

const ACTOR = "agent:autotest";

// Bugs go through PowerLoom's bug endpoint (the same path QA's bugs and a chat's bug_report take): a [BUG] task under
// the PBI plus its bug record, prepared for the pipeline on the next tick. Returns the created ids in the drafts'
// order, so `bug:<n>` references resolve.
export async function commitBugs(powerloomUrl: string, pbiId: number, bugs: AutotestDraft["bugs"], fetcher: typeof fetch = fetch): Promise<string[]> {
  const ids: string[] = [];

  for (const bug of bugs) {
    ids.push(await createBug(powerloomUrl, pbiId, bug, fetcher));
  }

  return ids;
}

async function createBug(powerloomUrl: string, pbiId: number, bug: AutotestDraft["bugs"][number], fetcher: typeof fetch): Promise<string> {
  const body = { parent: String(pbiId), title: bug.title, descriptionMd: renderBug(bug, pbiId), priority: bug.priority, actor: ACTOR };
  const response = await fetcher(`${powerloomUrl}/api/bugs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  if (!response.ok) {
    throw new Error(`PowerLoom refused the bug "${bug.title}": ${response.status} ${(await response.text()).slice(0, 300)}`);
  }

  // ReportedBug: the bug is a child work item; its page is PBI-<adoId>.
  const created = (await response.json()) as { adoId: number };

  return `PBI-${created.adoId}`;
}
