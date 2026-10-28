import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoAllowedBuiltInTools, builtInTools, permissionMode } from "./builtInTools";

describe("builtInTools", () => {
  it("enables nothing without grants", () => {
    assert.deepEqual(builtInTools(undefined), []);
    assert.deepEqual(builtInTools({}), []);
    assert.equal(permissionMode(undefined), "dontAsk");
  });

  it("maps each grant to Claude Code's tools", () => {
    assert.deepEqual(builtInTools({ webAccess: true }), ["WebSearch", "WebFetch"]);
    assert.deepEqual(builtInTools({ readCode: true }), ["Read", "Grep", "Glob"]);
    assert.deepEqual(builtInTools({ editCode: true }), ["Edit", "Write", "NotebookEdit"]);
    assert.deepEqual(builtInTools({ shell: true }), ["Bash"]);
    assert.deepEqual(builtInTools({ subAgents: true }), ["Agent"]);
  });

  it("ignores a grant set to false", () => {
    assert.deepEqual(builtInTools({ readCode: true, shell: false }), ["Read", "Grep", "Glob"]);
  });

  it("keeps a read-only run in dontAsk with its tools allowed", () => {
    const capabilities = { readCode: true, subAgents: true };

    assert.equal(permissionMode(capabilities), "dontAsk");
    assert.deepEqual(autoAllowedBuiltInTools(capabilities), ["Read", "Grep", "Glob", "Agent"]);
  });

  it("accepts edits through the mode, not through allowedTools", () => {
    const capabilities = { readCode: true, editCode: true, shell: true };

    assert.equal(permissionMode(capabilities), "acceptEdits");
    assert.deepEqual(autoAllowedBuiltInTools(capabilities), ["Read", "Grep", "Glob", "Bash"]);
  });

  it("gives a shell-only run the acceptEdits mode too", () => {
    assert.equal(permissionMode({ shell: true }), "acceptEdits");
  });
});
