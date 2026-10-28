import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLAUDE_COPIED_NOTICE, launchDesktopChat } from "./launchDesktopChat";

describe("opening an existing desktop chat", () => {
  it("waits for the clipboard, then notifies before navigating to Claude", async () => {
    const events: string[] = [];
    let finish!: () => void;
    const copied = new Promise<void>((resolve) => { finish = resolve; });
    const result = launchDesktopChat({ ok: true, message: "", link: "claude://code/continue?session=local_test", clipboardText: "Read item.md" }, {
      copy: async (text) => { events.push(text); await copied; },
      notify: (message) => events.push(message),
      navigate: (url) => events.push(url),
    });
    assert.deepEqual(events, ["Read item.md"]);
    finish();
    assert.deepEqual(await result, { error: null, manual: null });
    assert.deepEqual(events, ["Read item.md", CLAUDE_COPIED_NOTICE, "claude://code/continue?session=local_test"]);
  });

  it("exposes the prompt and does not navigate or claim success when copying is denied", async () => {
    const launch = { ok: true, message: "", link: "claude://code/continue?session=local_test", clipboardText: "Read item.md" };
    const result = await launchDesktopChat(launch, {
      copy: async () => { throw new Error("Permission denied"); },
      notify: () => assert.fail("must not claim that copying succeeded"),
      navigate: () => assert.fail("must leave the fallback visible"),
    });
    assert.equal(result.manual, launch);
    assert.match(result.error!, /Couldn't copy/);
  });

  it("opens the Codex prefill link without accessing the clipboard", async () => {
    const events: string[] = [];
    await launchDesktopChat({ ok: true, message: "", link: "codex://threads/test?prompt=Read%20item.md" }, {
      copy: async () => assert.fail("Codex does not need a clipboard write"),
      notify: (message) => events.push(message),
      navigate: (url) => events.push(url),
    });
    assert.deepEqual(events, ["Opening the chat…", "codex://threads/test?prompt=Read%20item.md"]);
  });

  it("does nothing to the desktop or clipboard after a refused backend request", async () => {
    const unexpected = () => assert.fail("a refused launch has no desktop side effects");
    const result = await launchDesktopChat({ ok: false, message: "Conversation was deleted", link: null }, { copy: async () => unexpected(), notify: unexpected, navigate: unexpected });
    assert.deepEqual(result, { error: "Conversation was deleted", manual: null });
  });
});
