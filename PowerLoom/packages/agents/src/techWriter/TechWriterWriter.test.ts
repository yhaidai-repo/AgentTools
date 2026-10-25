import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadLog } from "../evidence/ReadLog";
import type { AgentDeps } from "../models/AgentDeps";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { TechWriterWriter } from "./TechWriterWriter";

function spyDeps() {
  const calls: string[] = [];
  const writer = { removeFile: async (path: string) => void calls.push(`remove ${path}`), writeNote: async (path: string) => void calls.push(`write ${path}`), readNote: async () => null };
  const db = new Proxy({}, { get: () => () => { calls.push("db"); throw new Error("no database in this test"); } });

  return { calls, deps: { db, docsVault: writer, docsRoot: "/vault", docsVaultName: "docs", vaults: null } as unknown as AgentDeps };
}

function draftTarget(deps: AgentDeps, taskIds: string[] = []): WriterTarget {
  const task = { id: "DT-001", kind: "draft-merge", pbiId: null, vault: "docs", data: { draft: "pos-topic", path: "draft/pos-topic.md" } };
  const result = { status: "complete", body: "Merged", data: null, evidence: [], waitingFor: [] };

  return { deps, task, runId: 7, agentId: "tech-writer", tasks: [], taskIds, result, budgetStopped: false } as unknown as WriterTarget;
}

describe("TechWriterWriter.commit", () => {
  it("leaves the draft and its capture alone when nothing was merged into a note, and says what is missing", async () => {
    const { calls, deps } = spyDeps();
    const writer = new TechWriterWriter(deps);

    assert.deepEqual(await writer.commit(draftTarget(deps)), []);
    assert.deepEqual(calls, []);
    assert.deepEqual(writer.settlement(), { kind: "missing", output: "the draft merged into a note (write_note)" });
  });

  it("waits for what it handed on instead of counting a staged, unwritten note as merged", async () => {
    const { calls, deps } = spyDeps();
    const writer = new TechWriterWriter(deps);
    const writeNote = writer.tools(new ReadLog("Draft DT-001")).find((tool) => tool.name === "write_note")!;

    await writeNote.handler({ path: "shop/orders/returns.md", content: "---\ntitle: Returns\n---\nFacts", takesDraftPlace: true });

    assert.deepEqual(await writer.commit(draftTarget(deps, ["Q-1-002"])), []);
    assert.deepEqual(calls, []);
    assert.deepEqual(writer.settlement(), { kind: "waits", ids: ["Q-1-002"], reason: "The notes wait for what the tech-writer handed on" });
  });
});
