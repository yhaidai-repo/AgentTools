import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deviceCodeOf } from "./deviceCodeOf";

describe("the link and code of codex login --device-auth", () => {
  it("are read from coloured output", () => {
    const output = "Welcome to Codex\n\u001b[94mhttps://auth.openai.com/codex/device\u001b[0m\nEnter this one-time code \u001b[1mABCD-12345\u001b[0m\n";

    assert.deepEqual(deviceCodeOf(output), { verificationUri: "https://auth.openai.com/codex/device", userCode: "ABCD-12345" });
  });

  it("drop punctuation glued to the link", () => {
    assert.deepEqual(deviceCodeOf("Open https://auth.openai.com/codex/device. Code: WXYZ-9876"), { verificationUri: "https://auth.openai.com/codex/device", userCode: "WXYZ-9876" });
  });

  it("are missing until both were printed", () => {
    assert.equal(deviceCodeOf("Open https://auth.openai.com/codex/device"), null);
    assert.equal(deviceCodeOf("Code: WXYZ-9876"), null);
  });
});
