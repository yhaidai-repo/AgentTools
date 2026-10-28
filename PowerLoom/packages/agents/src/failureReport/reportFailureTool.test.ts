import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FailureReportRun, MAX_REPORTS_PER_RUN } from "./FailureReportRun";
import type { FailureReportStore } from "./models/FailureReportStore";
import type { NewFailureReport } from "./models/NewFailureReport";
import { createReportFailureTool } from "./reportFailureTool";

const context = { vault: "work-projects", agentId: "better-research", runId: 42, owner: "powerloom-run-42", taskId: "AT-1-001", pbiId: 1 };

const failure = { kind: "source_unreachable", tool: "search_web", target: "searxng", saw: "google and bing did not respond; 0 results", workaround: "other_tool", instead: "used native WebSearch", impact: "none" };

function memoryStore(): { store: FailureReportStore; reports: NewFailureReport[] } {
  const reports: NewFailureReport[] = [];

  return { store: { add: async (report) => reports.push(report) }, reports };
}

describe("report_failure", () => {
  it("records the failure with who reported it from the run, and answers with the id", async () => {
    const { store, reports } = memoryStore();
    const tool = createReportFailureTool(store, context, new FailureReportRun());

    const result = await tool.handler(failure);

    assert.equal(result.text, "Recorded as FR-1. Go on; name the gap in your result if there is one.");
    assert.deepEqual(reports, [{ vault: "work-projects", agentId: "better-research", runId: 42, taskId: "AT-1-001", pbiId: 1, ...failure }]);
  });

  it("stores missing optional fields as null", async () => {
    const { store, reports } = memoryStore();
    const tool = createReportFailureTool(store, context, new FailureReportRun());

    await tool.handler({ ...failure, tool: undefined, instead: undefined });

    assert.equal(reports[0].tool, null);
    assert.equal(reports[0].instead, null);
  });

  it("refuses a second report of the same cause and names the first", async () => {
    const { store, reports } = memoryStore();
    const tool = createReportFailureTool(store, context, new FailureReportRun());

    await tool.handler(failure);
    const result = await tool.handler({ ...failure, target: "SearXNG", saw: "again" });

    assert.equal(result.text, "Already reported as FR-1.");
    assert.equal(reports.length, 1);
  });

  it("keeps different causes apart", async () => {
    const { store, reports } = memoryStore();
    const tool = createReportFailureTool(store, context, new FailureReportRun());

    await tool.handler(failure);
    await tool.handler({ ...failure, kind: "tool_error" });
    await tool.handler({ ...failure, tool: "WebFetch" });

    assert.equal(reports.length, 3);
  });

  it("stops at the run's cap", async () => {
    const { store, reports } = memoryStore();
    const tool = createReportFailureTool(store, context, new FailureReportRun());

    for (let index = 0; index < MAX_REPORTS_PER_RUN; index++) {
      await tool.handler({ ...failure, target: `host-${index}` });
    }

    const result = await tool.handler({ ...failure, target: "one-too-many" });

    assert.equal(reports.length, MAX_REPORTS_PER_RUN);
    assert.match(result.text, /Report limit reached \(20\)/);
  });

  it("answers with text, not an error, when the report can't be stored", async () => {
    const tool = createReportFailureTool({ add: async () => { throw new Error("connection refused"); } }, context, new FailureReportRun());

    const result = await tool.handler(failure);

    assert.equal(result.text, "Could not record the report (connection refused). Name the failure in your result.");
    assert.notEqual(result.isError, true);
  });

  it("counts a report that failed to store as not reported, so a retry can succeed", async () => {
    let fail = true;
    const tool = createReportFailureTool({ add: async () => { if (fail) { throw new Error("down"); } return 7; } }, context, new FailureReportRun());

    await tool.handler(failure);
    fail = false;
    const result = await tool.handler(failure);

    assert.match(result.text, /^Recorded as FR-7/);
  });
});
