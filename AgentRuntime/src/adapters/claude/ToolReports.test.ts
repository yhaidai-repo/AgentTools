import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ToolReports } from "./ToolReports";

describe("ToolReports", () => {
  it("holds a call's reports under the tool_use id Claude Code sent, until they are drained once", () => {
    const reports = new ToolReports();
    const call = reports.contextFor("sandbox_restore", { _meta: { "claudecode/toolUseId": "toolu_1" } });

    call.progress("step 1/2 dotnet restore App.sln");
    call.progress("step 2/2 npm ci");

    const drained = reports.drain();

    assert.deepEqual(drained.map((report) => [report.callId, report.name, report.detail]), [
      ["toolu_1", "sandbox_restore", "step 1/2 dotnet restore App.sln"],
      ["toolu_1", "sandbox_restore", "step 2/2 npm ci"],
    ]);
    assert.ok(drained.every((report) => report.type === "tool_progress" && report.elapsedMs >= 0));
    assert.deepEqual(reports.drain(), []);
  });

  it("drops the reports of a call without a tool_use id, which no trace line could name", () => {
    const reports = new ToolReports();

    reports.contextFor("sandbox_restore", {}).progress("copying");
    reports.contextFor("sandbox_restore", undefined).progress("copying");

    assert.deepEqual(reports.drain(), []);
  });
});
