import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AzureMcpServer } from "./AzureMcpServer";

// Starts the real server (no Azure call): the wrapper resolves, the binary runs on this platform, the tools come
// with their schemas and the read-only hint.
describe("AzureMcpServer", () => {
  it("starts the server for a namespace and lists its tools", async () => {
    const server = await AzureMcpServer.start({ namespaces: ["group"], env: {} });

    try {
      const names = server.tools().map((tool) => tool.name);
      const list = server.tools().find((tool) => tool.name === "group_list");

      assert.ok(names.includes("group_list"), `got ${names.join(", ")}`);
      assert.equal(list?.readOnly, true);
      assert.equal(list?.inputSchema.properties.subscription?.type, "string");
    } finally {
      await server.close();
    }
  });
});
