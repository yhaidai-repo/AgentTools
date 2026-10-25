import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentDeps } from "../models/AgentDeps";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { TechWriterWriter } from "./TechWriterWriter";

function spyDeps() {
  const calls: string[] = [];
  const writer = { removeFile: async (path: string) => void calls.push(`remove ${path}`), writeNote: async (path: string) => void calls.push(`write ${path}`), readNote: async () => null };
  const db = new Proxy({}, { get: () => () => { calls.push("db"); throw new Error("no database in this test"); } });

  return { calls, deps: { db, docsVault: writer, docsRoot: "/vault", docsVaultName: "docs", vaults: null } as unknown as AgentDeps };
}

function draftTarget(deps: AgentDeps): WriterTarget {
  const task = { id: "DT-001", kind: "draft-merge", pbiId: null, vault: "docs", data: { draft: "pos-topic", path: "draft/pos-topic.md" } };

  return { deps, task, runId: 7, agentId: "tech-writer", tasks: [], taskIds: [], result: null, budgetStopped: false } as unknown as WriterTarget;
}

describe("TechWriterWriter.commit", () => {
  it("leaves the draft and its capture alone when nothing was merged into a note, and says what is missing", async () => {
    const { calls, deps } = spyDeps();
    const writer = new TechWriterWriter(deps);

    assert.deepEqual(await writer.commit(draftTarget(deps)), []);
    assert.deepEqual(calls, []);
    assert.deepEqual(writer.settlement(), { kind: "missing", output: "the draft merged into a note (write_note)" });
  });
});
