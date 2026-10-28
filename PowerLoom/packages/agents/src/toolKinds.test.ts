import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyToolCall } from "./toolKinds";

describe("classifyToolCall", () => {
  it("reads a PowerLoom command, as a chat calls it over MCP, as PowerLoom's own", () => {
    assert.deepEqual(classifyToolCall("agent_create", { id: "probe" }), { kind: "internal", resource: "agent_create", target: "agent_create", request: "{\"id\":\"probe\"}" });
    assert.equal(classifyToolCall("pbi_read", {}).kind, "internal");
  });

  it("reads report_failure as PowerLoom's own, though report_ is no write prefix", () => {
    assert.equal(classifyToolCall("report_failure", { kind: "tool_error" }).kind, "internal");
  });

  it("reads the commands on the vault as docs and the ones on skills as skills", () => {
    assert.equal(classifyToolCall("vault_registers", {}).kind, "docs");
    assert.equal(classifyToolCall("vault_notes", { folder: "pos" }).request, "pos");
    assert.deepEqual(classifyToolCall("skill_get", { name: "powerloom-code-review" }).resource, "powerloom-code-review");
  });

  it("reads the web tools as web: the page's host, or the search's query", () => {
    assert.deepEqual(classifyToolCall("read_web_page", { url: "https://www.cms.gov/files/a.pdf", offset: 0 }), { kind: "web", resource: "www.cms.gov", target: "read_web_page", request: "https://www.cms.gov/files/a.pdf" });
    assert.deepEqual(classifyToolCall("web_search", { query: "HETS 270 companion guide" }), { kind: "web", resource: "web search", target: "web_search", request: "HETS 270 companion guide" });
  });

  it("keeps the docs readers as docs and an unknown tool as other", () => {
    assert.equal(classifyToolCall("read_doc", { path: "pos/index.md" }).kind, "docs");
    assert.equal(classifyToolCall("some_new_tool", {}).kind, "other");
  });
});
