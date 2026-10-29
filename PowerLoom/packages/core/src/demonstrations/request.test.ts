import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guideRequestBlock, guideRequestSchema, guideUrlAllowed, readGuideRequest } from "./request";

const base = { mode: "remote-url", url: "https://app.example.test/admin", allowedOrigins: ["https://app.example.test"], audience: "Support", environment: "dev", permittedActions: "view only", data: "synthetic tenant", owner: "Support" };

describe("demonstration inputs", () => {
  it("round trips structured input through the same text task envelope used by chats and schedules", () => {
    const request = guideRequestSchema.parse(base);
    assert.deepEqual(readGuideRequest("Document the form." + guideRequestBlock(request)), request);
  });
  it("accepts remote mode without inventing local services or a branch", () => {
    assert.deepEqual(guideRequestSchema.parse(base).services, []);
    assert.equal(guideRequestSchema.parse(base).branch, "");
  });
  it("requires exact local services and branch", () => {
    assert.equal(guideRequestSchema.safeParse({ ...base, mode: "local-stack" }).success, false);
    assert.equal(guideRequestSchema.safeParse({ ...base, mode: "local-stack", services: ["web"], branch: "feature/example" }).success, true);
  });
  for (const url of ["file:///private", "https://user:password@app.example.test", "https://app.example.test?token=secret", "https://app.example.test#token"]) {
    it("refuses secret-bearing or non-web entry URL " + url.split(":")[0], () => assert.equal(guideRequestSchema.safeParse({ ...base, url }).success, false));
  }
  it("matches origins exactly, including scheme and port", () => {
    assert.ok(guideUrlAllowed("https://app.example.test/admin", base.allowedOrigins));
    for (const url of ["https://app.example.test.attacker.test", "https://app.example.test:1234", "http://app.example.test", "https://name:secret@app.example.test"]) assert.equal(guideUrlAllowed(url, base.allowedOrigins), false);
  });
  it("requires an expected base version and scope for a Confluence update", () => {
    assert.equal(guideRequestSchema.safeParse({ ...base, destination: { action: "update", site: "https://docs.example.test", space: "AA", title: "Example", pageId: "123" } }).success, false);
  });
});
