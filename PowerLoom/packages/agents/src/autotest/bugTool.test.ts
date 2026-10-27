import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadLog } from "../evidence/ReadLog";
import { createBugTool, renderBug } from "./bugTool";
import { commitBugs } from "./commitBugs";
import type { AutotestDraft } from "./models/AutotestDraft";

const evidence = [{ source: "S0", ref: "PBI-1 acceptance criteria", note: "AC 2 expects a warning" }];

function bugInput() {
  return { title: "No warning after archiving", criterion: "AC 2: a warning appears", case: "Warning shown", steps: ["Archive a row"], expected: "Warning banner", actual: "Nothing shown", evidence, artifacts: ["D:/x/warning/video.webm"], suspected_cause: "ArchiveHandler skips the notice (inferred)" };
}

describe("report_bug", () => {
  it("collects the bug and answers with its number", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };

    const result = await createBugTool(draft, new ReadLog("AC 2 expects a warning")).handler(bugInput());

    assert.match(result.text, /^Noted as bug:1;/);
    assert.equal(draft.bugs[0].suspectedCause, "ArchiveHandler skips the notice (inferred)");
    assert.equal(draft.bugs[0].priority, null);
  });

  it("refuses evidence the run never read", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };

    const result = await createBugTool(draft, new ReadLog("AC 2 expects a warning")).handler({ ...bugInput(), evidence: [{ ...evidence[0], source: "S5" }] });

    assert.equal(result.isError, true);
    assert.equal(draft.bugs.length, 0);
  });
});

describe("commitBugs", () => {
  it("creates each bug through PowerLoom's bug endpoint under the PBI and returns their ids", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
    await createBugTool(draft, new ReadLog("AC 2 expects a warning")).handler(bugInput());
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init?.body)) });

      return new Response(JSON.stringify({ adoId: 40001, parentId: 1 }), { status: 200 });
    }) as unknown as typeof fetch;

    const ids = await commitBugs("http://powerloom:8080", 1, draft.bugs, "TT-1", fetcher);

    assert.deepEqual(ids, ["PBI-40001"]);
    assert.equal(requests[0].url, "http://powerloom:8080/api/bugs");
    assert.equal(requests[0].body.parent, "1");
    assert.equal(requests[0].body.actor, "agent:autotest");
    assert.match(String(requests[0].body.descriptionMd), /\*\*Actual:\*\* Nothing shown/);
  });

  it("fails the commit when PowerLoom refuses a bug", async () => {
    const draft: AutotestDraft = { report: null, tasks: [], captures: [], bugs: [] };
    await createBugTool(draft, new ReadLog("AC 2 expects a warning")).handler(bugInput());
    const fetcher = (async () => new Response("A title of 1 to 120 characters is required.", { status: 400 })) as unknown as typeof fetch;

    await assert.rejects(() => commitBugs("http://powerloom:8080", 1, draft.bugs, "TT-1", fetcher), /refused the bug/);
  });
});

describe("renderBug", () => {
  it("lays out the bug for the PBI page", () => {
    const text = renderBug({ ...bugInput(), suspectedCause: "ArchiveHandler (inferred)", priority: 2 }, 1);

    assert.match(text, /^Found by the Autotest agent on PBI-1, case "Warning shown"\./);
    assert.match(text, /1\. Archive a row\n\*\*Expected:\*\* Warning banner\n\*\*Actual:\*\* Nothing shown\n\*\*Suspected cause:\*\* ArchiveHandler \(inferred\)/);
    assert.match(text, /\*\*Recording\*\*\n- D:\/x\/warning\/video\.webm/);
  });
});
