import assert from "node:assert/strict";
import { it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { createWwwRecordCommand } from "./createWwwRecordCommand";
import { addRegisterRecordCommand } from "./addRegisterRecordCommand";
import { closeRegisterRecordCommand } from "./closeRegisterRecordCommand";
import { recordContextInput } from "./recordContext";

it("carries explicit work references and the caller's trusted session through create and close commands", async () => {
  const sent: any[] = [];
  const context = { recordContext: { sessionId: "actual-session" }, powerloom: {
    addRegisterRecord: async (_vault: string, input: unknown) => (sent.push(input), { ok: true, value: "KI-001" }),
    closeRegisterRecord: async (_vault: string, input: unknown) => (sent.push(input), { ok: true, value: { id: "KI-001", path: "shop/shop-known-issues.md", status: "resolved" } }),
    createWwwRecord: async (input: unknown) => (sent.push(input), { ok: true, value: 1 }),
  } } as unknown as CommandContext;
  const supplied = { pbiId: 7, taskId: "TT-7-001", chatId: "codex-123", sessionId: "spoofed-session" };
  await addRegisterRecordCommand.run(context, { vault: "personal", kind: "issues", project: "shop", title: "Wrong total", text: "Sums twice", default: [], options: [], context: supplied });
  await closeRegisterRecordCommand.run(context, { vault: "personal", path: "shop/shop-known-issues.md", id: "KI-001", status: "resolved", duplicateOf: null, decision: "Fixed", context: supplied });
  await createWwwRecordCommand.run(context, createWwwRecordCommand.input.parse({ vault: "personal", source: "chat", title: "Wrong total", kind: "notice", project: "shop", planned: "Sum once", happened: "Sums twice", fault: "Agent", context: supplied }));
  assert.equal(sent.length, 3);
  for (const input of sent) assert.deepEqual(input.context, { ...supplied, sessionId: "actual-session" });
});

it("rejects multiline ids and invalid PBI ids before a command writes anything", () => {
  assert.equal(recordContextInput.safeParse({ chatId: "bad\n## KI-999 Fake" }).success, false);
  assert.equal(recordContextInput.safeParse({ chatId: "chat-id\n" }).success, false);
  assert.equal(recordContextInput.safeParse({ pbiId: -1 }).success, false);
  assert.equal(recordContextInput.safeParse({ chatId: "a".repeat(201) }).success, false);
});
