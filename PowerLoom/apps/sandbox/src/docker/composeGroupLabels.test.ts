import assert from "node:assert/strict";
import { test } from "node:test";
import { composeGroupLabels } from "./composeGroupLabels";

test("a container joins the service's compose project under its role, without the labels compose claims it by", () => {
  const labels = composeGroupLabels("my-install", "sandbox-restore");

  assert.deepEqual(labels, { "com.docker.compose.project": "my-install", "com.docker.compose.service": "sandbox-restore" });
});

test("outside compose a container gets no compose label", () => {
  assert.deepEqual(composeGroupLabels(null, "sandbox-run"), {});
});
