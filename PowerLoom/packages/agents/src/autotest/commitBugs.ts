import type { AutotestDraft } from "./models/AutotestDraft";
import { renderBug } from "./bugTool";
import { createHash } from "node:crypto";

const ACTOR = "agent:autotest";

// Bugs go through PowerLoom's bug endpoint (the same path QA's bugs and a chat's bug_report take): a [BUG] task under
// the PBI plus its bug record, prepared for the pipeline on the next tick. Returns the created ids in the drafts'
// order, so `bug:<n>` references resolve.
export async function commitBugs(powerloomUrl: string, pbiId: number, bugs: AutotestDraft["bugs"], taskId: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const ids: string[] = [];

  for (const bug of bugs) {
    const identity = createHash("sha256").update(JSON.stringify([taskId, pbiId, bug])).digest("hex");
    ids.push(await createBug(powerloomUrl, pbiId, bug, `autotest:${identity}`, fetcher));
  }

  return ids;
}

async function createBug(powerloomUrl: string, pbiId: number, bug: AutotestDraft["bugs"][number], clientRequestId: string, fetcher: typeof fetch): Promise<string> {
  const body = { parent: String(pbiId), title: bug.title, descriptionMd: renderBug(bug, pbiId), priority: bug.priority, actor: ACTOR, clientRequestId };
  const response = await fetcher(`${powerloomUrl}/api/bugs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  if (!response.ok) {
    throw new Error(`PowerLoom refused the bug "${bug.title}": ${response.status} ${(await response.text()).slice(0, 300)}`);
  }

  // ReportedBug: the bug is a child work item; its page is PBI-<adoId>.
  const created = (await response.json()) as { adoId: number };

  return `PBI-${created.adoId}`;
}
