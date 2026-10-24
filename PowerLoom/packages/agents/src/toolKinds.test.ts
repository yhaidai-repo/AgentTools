import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyToolCall } from "./toolKinds";

describe("classifyToolCall", () => {
  it("reads a PowerLoom command, as a chat calls it over MCP, as PowerLoom's own", () => {
    assert.deepEqual(classifyToolCall("agent_create", { id: "probe" }), { kind: "internal", resource: "agent_create", target: "agent_create", request: "{\"id\":\"probe\"}" });
    assert.equal(classifyToolCall("pbi_read", {}).kind, "internal");
  });

  it("reads the commands on the vault as docs and the ones on skills as skills", () => {
    assert.equal(classifyToolCall("vault_registers", {}).kind, "docs");
    assert.equal(classifyToolCall("vault_notes", { folder: "pvs" }).request, "pvs");
    assert.deepEqual(classifyToolCall("skill_get", { name: "powerloom-code-review" }).resource, "powerloom-code-review");
  });

  it("keeps the docs readers as docs and an unknown tool as other", () => {
    assert.equal(classifyToolCall("read_doc", { path: "pvs/index.md" }).kind, "docs");
    assert.equal(classifyToolCall("some_new_tool", {}).kind, "other");
  });
});
