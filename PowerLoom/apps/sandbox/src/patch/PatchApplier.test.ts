import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileStore } from "../models/FileStore";
import { PatchApplier } from "./PatchApplier";
import { PatchParser } from "./PatchParser";

class MemoryFiles implements FileStore {
  constructor(readonly files: Map<string, string>) {}

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}

async function applied(files: Record<string, string>, patch: string) {
  const store = new MemoryFiles(new Map(Object.entries(files)));
  const parsed = PatchParser.parse(patch);

  assert.ok(parsed.ok, parsed.ok ? "" : parsed.reason);

  const outcome = await new PatchApplier(store).apply(parsed.value);

  return { outcome, files: Object.fromEntries(store.files) };
}

test("adds a file with a final newline", async () => {
  const { outcome, files } = await applied({}, "*** Begin Patch\n*** Add File: a.txt\n+one\n+two\n*** End Patch");

  assert.ok(outcome.ok);
  assert.equal(files["a.txt"], "one\ntwo\n");
});

test("updates several hunks in order and keeps CRLF and the BOM", async () => {
  const patch = "*** Begin Patch\n*** Update File: a.cs\n@@ class A\n-  int x;\n+  int y;\n@@\n   void B() {}\n+  void C() {}\n*** End Patch";
  const { outcome, files } = await applied({ "a.cs": "﻿class A\r\n  int x;\r\n  void B() {}\r\n" }, patch);

  assert.ok(outcome.ok);
  assert.equal(files["a.cs"], "﻿class A\r\n  int y;\r\n  void B() {}\r\n  void C() {}\r\n");
});

test("matches lines whose trailing spaces differ", async () => {
  const { outcome, files } = await applied({ "a.txt": "keep   \nold\n" }, "*** Begin Patch\n*** Update File: a.txt\n keep\n-old\n+new\n*** End Patch");

  assert.ok(outcome.ok);
  assert.equal(files["a.txt"], "keep   \nnew\n");
});

test("deletes and moves files", async () => {
  const patch = "*** Begin Patch\n*** Delete File: gone.txt\n*** Update File: old.txt\n*** Move to: new.txt\n@@\n-a\n+b\n*** End Patch";
  const { outcome, files } = await applied({ "gone.txt": "x\n", "old.txt": "a\n" }, patch);

  assert.ok(outcome.ok);
  assert.deepEqual(files, { "new.txt": "b\n" });
  assert.deepEqual(outcome.value, [{ path: "gone.txt", op: "delete" }, { path: "old.txt", op: "move", movedTo: "new.txt" }]);
});

test("a hunk that doesn't match leaves every file untouched", async () => {
  const patch = "*** Begin Patch\n*** Add File: b.txt\n+new\n*** Update File: a.txt\n-missing\n+x\n*** End Patch";
  const { outcome, files } = await applied({ "a.txt": "present\n" }, patch);

  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? "" : outcome.reason, /a\.txt: hunk 1 doesn't match/);
  assert.deepEqual(files, { "a.txt": "present\n" });
});

test("refuses to add a file that exists and to update one that doesn't", async () => {
  const added = await applied({ "a.txt": "x\n" }, "*** Begin Patch\n*** Add File: a.txt\n+y\n*** End Patch");
  const updated = await applied({}, "*** Begin Patch\n*** Update File: a.txt\n-x\n+y\n*** End Patch");

  assert.match(added.outcome.ok ? "" : added.outcome.reason, /already exists/);
  assert.match(updated.outcome.ok ? "" : updated.outcome.reason, /doesn't exist/);
});

test("an end-of-file hunk matches the last lines", async () => {
  const patch = "*** Begin Patch\n*** Update File: a.txt\n@@\n-x\n+z\n*** End of File\n*** End Patch";
  const { outcome, files } = await applied({ "a.txt": "x\ny\nx\n" }, patch);

  assert.ok(outcome.ok);
  assert.equal(files["a.txt"], "x\ny\nz\n");
});

test("a later section of the same patch sees an earlier one's change", async () => {
  const patch = "*** Begin Patch\n*** Update File: a.txt\n-1\n+2\n*** Update File: a.txt\n-2\n+3\n*** End Patch";
  const { outcome, files } = await applied({ "a.txt": "1\n" }, patch);

  assert.ok(outcome.ok);
  assert.equal(files["a.txt"], "3\n");
});

test("the parser names what is wrong", () => {
  const missingEnvelope = PatchParser.parse("*** Update File: a\n-x");
  const badLine = PatchParser.parse("*** Begin Patch\n*** Update File: a\n@@\n?x\n*** End Patch");

  assert.match(missingEnvelope.ok ? "" : missingEnvelope.reason, /must start with/);
  assert.match(badLine.ok ? "" : badLine.reason, /line 4: a hunk line starts with/);
});
