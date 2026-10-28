import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatTarget } from "../models/ChatTarget";
import type { ChatDestination } from "../models/ChatDestination";
import type { CommandContext } from "../models/CommandContext";
import { openChatCommand } from "./openChatCommand";

// Answers the item read with `item`, and the hand-off read with `handoffs` (each row as the join returns it).
function fakeDb(item: { id: string; data: unknown } | null, handoffs: unknown[] = []) {
  return {
    select: () => ({ from: () => ({
      where: async () => (item ? [item] : []),
      innerJoin: () => ({ where: () => ({ orderBy: async () => handoffs }) }),
    }) }),
  };
}

describe("chat.open", () => {
  it("forwards the explicitly selected conversation and preserves Claude's clipboard prompt", async () => {
    const destination: ChatDestination = { launcher: "claude-desktop", conversationId: "local_11111111-1111-4111-8111-111111111111" };
    const expected = { ok: true, value: { url: "claude://code/continue?session=test", clipboardText: "Read handoff.md" } };
    const context = { db: fakeDb({ id: "FND-1", data: null }), powerloom: { openChat: async (target: ChatTarget, selected?: ChatDestination, handoff?: string | null) => {
      assert.deepEqual(target, { kind: "item", itemId: "FND-1" });
      assert.deepEqual(selected, destination);
      assert.equal(handoff, null);
      return expected;
    } } } as unknown as CommandContext;
    const input = openChatCommand.input.parse({ target: { kind: "item", itemId: "FND-1" }, destination });
    assert.deepEqual(await openChatCommand.run(context, input), expected);
  });

  it("opens an import chat on a vault with the PC folder, trimmed", async () => {
    const opened: ChatTarget[] = [];
    const context = { powerloom: { openChat: async (target: ChatTarget) => (opened.push(target), { ok: true, value: { url: "claude://code/new" } }) } } as unknown as CommandContext;
    const input = openChatCommand.input.parse({ target: { kind: "import", vault: "work", folder: "  D:/Docs/Specs " } });

    assert.deepEqual(await openChatCommand.run(context, input), { ok: true, value: { url: "claude://code/new" } });
    assert.deepEqual(opened, [{ kind: "import", vault: "work", folder: "D:/Docs/Specs" }]);
  });

  it("gives an item's chat note the hand-off it came with, rendered as its agent reads it", async () => {
    const row = { handoff: { id: 1, fromTaskId: "PT-1-001", fromAgent: "planning", fromRunId: 812, toKind: "human", toItemId: "HT-1-002", intent: "review", gate: "approve", body: "Review the plan.", refs: { results: ["RUN-812"], items: [], notes: [] }, status: "open", createdAt: new Date(0), closedAt: null }, targetStatus: "open", targetResolution: null };
    const sections: (string | null | undefined)[] = [];
    const context = { db: fakeDb({ id: "HT-1-002", data: null }, [row]), powerloom: { openChat: async (_target: ChatTarget, _selected?: ChatDestination, handoff?: string | null) => (sections.push(handoff), { ok: true, value: { url: "claude://code/new" } }) } } as unknown as CommandContext;

    await openChatCommand.run(context, openChatCommand.input.parse({ target: { kind: "item", itemId: "HT-1-002" } }));

    assert.match(sections[0] ?? "", /^\*\*Handed off by\*\* PT-1-001 \(planning, RUN-812\): review the sender's output[\s\S]*Review the plan\.\n\nRead: Results RUN-812$/);
  });

  it("refuses an import without its folder", () => {
    assert.equal(openChatCommand.input.safeParse({ target: { kind: "import", vault: "work", folder: "  " } }).success, false);
    assert.equal(openChatCommand.input.safeParse({ target: { kind: "import", vault: "work" } }).success, false);
  });
});
