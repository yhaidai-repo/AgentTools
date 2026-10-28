import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import type { NewFailureReport } from "../models/NewFailureReport";
import { reportFailureCommand } from "./reportFailureCommand";

const failure = { vault: "work", kind: "tool_error", tool: "pbi_read", saw: "500 from the server", workaround: "continued_without", impact: "weaker_evidence" };

// A database that holds the rows inserted so far and answers the duplicate lookup with the first of them.
function fakeContext(): { context: CommandContext; inserted: NewFailureReport[] } {
  const inserted: NewFailureReport[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (inserted.length > 0 ? [{ id: 1 }] : []) }) }) }),
    insert: () => ({ values: (report: NewFailureReport) => ({ returning: async () => (inserted.push(report), [{ id: inserted.length }]) }) }),
  };

  return { context: { db, actor: "claude-code" } as unknown as CommandContext, inserted };
}

describe("failure.report", () => {
  it("records a chat's report of a PowerLoom tool, with the actor from the session and the tool as the target", async () => {
    const { context, inserted } = fakeContext();

    const outcome = await reportFailureCommand.run(context, reportFailureCommand.input.parse(failure));

    assert.deepEqual(outcome, { ok: true, value: { text: "Recorded as FR-1." } });
    assert.deepEqual(inserted, [{ vault: "work", origin: "chat", agentId: "chat", actor: "claude-code", runId: null, taskId: null, pbiId: null, kind: "tool_error", tool: "pbi_read", target: "pbi_read", saw: "500 from the server", workaround: "continued_without", instead: null, impact: "weaker_evidence" }]);
  });

  it("accepts the server itself as the failing tool", async () => {
    const { context } = fakeContext();

    const outcome = await reportFailureCommand.run(context, reportFailureCommand.input.parse({ ...failure, kind: "powerloom_unavailable", tool: "PowerLoom MCP" }));

    assert.equal(outcome.ok, true);
  });

  it("refuses a tool that isn't PowerLoom's, without writing", async () => {
    const { context, inserted } = fakeContext();

    const outcome = await reportFailureCommand.run(context, reportFailureCommand.input.parse({ ...failure, tool: "WebSearch" }));

    assert.equal(outcome.ok, false);
    assert.match((outcome as { error: string }).error, /WebSearch isn't a PowerLoom tool/);
    assert.deepEqual(inserted, []);
  });

  it("names the first report when the same cause is reported again the same day", async () => {
    const { context, inserted } = fakeContext();
    const input = reportFailureCommand.input.parse(failure);

    await reportFailureCommand.run(context, input);
    const again = await reportFailureCommand.run(context, input);

    assert.deepEqual(again, { ok: true, value: { text: "Already reported today as FR-1." } });
    assert.equal(inserted.length, 1);
  });

  it("asks nothing to be confirmed: it only records", () => {
    assert.match(reportFailureCommand.description, /no need to ask/);
  });
});
