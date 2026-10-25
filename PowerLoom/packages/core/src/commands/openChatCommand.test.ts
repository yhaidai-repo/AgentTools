import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatTarget } from "../models/ChatTarget";
import type { CommandContext } from "../models/CommandContext";
import { openChatCommand } from "./openChatCommand";

describe("chat.open", () => {
  it("opens an import chat on a vault with the PC folder, trimmed", async () => {
    const opened: ChatTarget[] = [];
    const context = { powerloom: { openChat: async (target: ChatTarget) => (opened.push(target), { ok: true, value: { url: "claude://code/new" } }) } } as unknown as CommandContext;
    const input = openChatCommand.input.parse({ target: { kind: "import", vault: "work", folder: "  D:/Docs/Specs " } });

    assert.deepEqual(await openChatCommand.run(context, input), { ok: true, value: { url: "claude://code/new" } });
    assert.deepEqual(opened, [{ kind: "import", vault: "work", folder: "D:/Docs/Specs" }]);
  });

  it("refuses an import without its folder", () => {
    assert.equal(openChatCommand.input.safeParse({ target: { kind: "import", vault: "work", folder: "  " } }).success, false);
    assert.equal(openChatCommand.input.safeParse({ target: { kind: "import", vault: "work" } }).success, false);
  });
});
