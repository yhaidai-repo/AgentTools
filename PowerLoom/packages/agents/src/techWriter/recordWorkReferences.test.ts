import assert from "node:assert/strict";
import { it } from "node:test";
import type { localItem, PowerLoomDb } from "@powerloom/db";
import { parseRegisterRecords } from "@powerloom/vault";
import { commitActualize } from "./commitTechWriter";
import type { TaskVault } from "./models/TaskVault";

it("attributes a rewritten maintenance record to the actual task/PBI and preserves its earlier creation", async () => {
  const old = "# Known issues\n\n## KI-001 Wrong total\n> **Open** · Created 2026-10-01 · Updated 2026-10-01\n\n**Issue**: Sums twice.\n- Created in: 2026-10-01 · chat:original-chat\n";
  let written = "";
  const vault = { name: "personal", isDocsVault: true, writer: {
    readNote: async () => old,
    writeNote: async (_path: string, content: string) => { written = content; },
  } } as unknown as TaskVault;
  const db = { insert: () => ({ values: async () => undefined }), update: () => ({ set: () => ({ where: async () => undefined }) }) } as unknown as PowerLoomDb;
  const task = { id: "WT-001", pbiId: 7 } as typeof localItem.$inferSelect;
  await commitActualize(db, vault, task, 1, { edits: [{ path: "shop/shop-known-issues.md", content: old.replace("Sums twice.", "Includes tax twice.") }], findings: [], home: null, summary: null });
  const references = parseRegisterRecords(written)[0].workItems!;
  assert.equal(references[0].chatId, "original-chat");
  assert.equal(references[1].action, "updated");
  assert.equal(references[1].taskId, "WT-001");
  assert.equal(references[1].pbiId, 7);
});
