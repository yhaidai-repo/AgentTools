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

it("keeps a checkpoint written before the optional stated-build input existed", () => {
  const request = guideRequestSchema.parse({ mode: "remote-url", url: "https://example.test", allowedOrigins: ["https://example.test"], audience: "Support", environment: "test", permittedActions: "view", data: "synthetic", owner: "Support" });
  const { build, ...previousRequest } = request;
  const body = "Document this.\n\n\x60\x60\x60demonstration\n" + JSON.stringify(previousRequest) + "\n\x60\x60\x60";
  const previousBody = body.replace("\x60\x60\x60demonstration", "\x60\x60\x60support-guide");
  const fingerprint = (input: unknown, value: string) => createHash("sha256").update(JSON.stringify({ request: input, body: value })).digest("hex");
  const checkpoint = { requestHash: fingerprint(previousRequest, previousBody), images: [{ name: "form.png" }], report: null };

  assert.deepEqual(renamedCheckpoint(previousBody, body, { guideCheckpoint: checkpoint }), {
    guideCheckpoint: { ...checkpoint, requestHash: fingerprint(request, body) },
  });
  const changedBody = body.replace('"owner":"Support"', '"owner":"Someone else"');
  const stale = { guideCheckpoint: checkpoint };
  assert.equal(renamedCheckpoint(previousBody, changedBody, stale), stale);
  const statedBody = body.replace('"owner":"Support"', '"owner":"Support","build":"abc"');
  assert.equal(renamedCheckpoint(previousBody, statedBody, stale), stale);
});
