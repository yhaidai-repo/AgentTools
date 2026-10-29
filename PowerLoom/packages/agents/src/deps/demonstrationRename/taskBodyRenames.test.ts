import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { it } from "node:test";
import { guideRequestBlock, guideRequestSchema } from "@powerloom/core";
import { renamedCheckpoint } from "./taskBodyRenames";

it("preserves captured media through the fence rename, but never validates a stale checkpoint", () => {
  const request = guideRequestSchema.parse({ mode: "remote-url", url: "https://example.test", allowedOrigins: ["https://example.test"], audience: "Support", environment: "test", permittedActions: "view", data: "synthetic", owner: "Support" });
  const body = "Document this." + guideRequestBlock(request);
  const previousBody = body.replace("\x60\x60\x60demonstration", "\x60\x60\x60support-guide");
  const fingerprint = (value: string) => createHash("sha256").update(JSON.stringify({ request, body: value, goal: "Show the form" })).digest("hex");
  const checkpoint = { requestHash: fingerprint(previousBody), images: [{ name: "form.png" }], report: { status: "partial" } };
  const data = { goal: "Show the form", guideCheckpoint: checkpoint, unrelated: true };

  assert.deepEqual(renamedCheckpoint(previousBody, body, data), { ...data, guideCheckpoint: { ...checkpoint, requestHash: fingerprint(body) } });
  assert.equal(data.guideCheckpoint.requestHash, fingerprint(previousBody));
  assert.equal(renamedCheckpoint(previousBody + "edited", body, data), data);
  assert.equal(renamedCheckpoint(previousBody, "invalid", data), data);
  assert.equal(renamedCheckpoint(previousBody, body, null), null);
});
