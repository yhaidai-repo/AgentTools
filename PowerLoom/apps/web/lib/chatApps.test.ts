import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { choosableApps } from "./chatApps";

const claude = { id: "claude-desktop", label: "Claude", connected: true };
const codex = { id: "codex-desktop", label: "Codex", connected: false };

describe("the chat app picker", () => {
  it("offers connected apps only", () => {
    assert.deepEqual(choosableApps({ current: "claude-desktop", apps: [claude, codex] }), [claude]);
  });

  it("keeps the chosen app even after it was disconnected, so saving doesn't change it silently", () => {
    assert.deepEqual(choosableApps({ current: "codex-desktop", apps: [claude, codex] }), [claude, codex]);
  });
});
