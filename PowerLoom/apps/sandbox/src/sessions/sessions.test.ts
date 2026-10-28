import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { workspacePath } from "../files/workspacePath";
import { cutOutput } from "./cutOutput";
import { OutputBuffer } from "./OutputBuffer";
import { SessionRegistry } from "./SessionRegistry";

function fakeProcess(exitCode = 0) {
  const stream = new PassThrough();

  return { stream, exitCode: async () => exitCode };
}

test("a read returns only what came since the last read", () => {
  const buffer = new OutputBuffer(100);

  buffer.append("one ");
  assert.equal(buffer.read(50).text, "one ");

  buffer.append("two");
  assert.equal(buffer.read(50).text, "two");
});

test("output dropped from a full buffer is reported", () => {
  const buffer = new OutputBuffer(5);

  buffer.append("0123456789");

  const read = buffer.read(50);

  assert.equal(read.truncated, true);
  assert.match(read.text, /5 earlier characters were dropped\]\n56789$/);
});

test("long output keeps its head and its tail", () => {
  const cut = cutOutput("a".repeat(10) + "b".repeat(80) + "c".repeat(10), 30, "; see x.log");

  assert.equal(cut.truncated, true);
  assert.ok(cut.text.startsWith("a".repeat(10)));
  assert.ok(cut.text.endsWith("c".repeat(10)));
  assert.match(cut.text, /70 characters cut; see x\.log/);
});

test("a session ends with its exit code, is read once more, then forgotten", async () => {
  const sessions = new SessionRegistry(2);
  const process = fakeProcess(3);
  const session = sessions.add("make", process);

  process.stream.write("done\n");
  process.stream.end();

  const output = await session.read(1_000, 100);

  sessions.forgetIfEnded(session);

  assert.deepEqual({ output: output.output, running: output.running, exitCode: output.exitCode }, { output: "done\n", running: false, exitCode: 3 });
  assert.equal(sessions.find(session.id).ok, false);
});

test("the session limit refuses one more and lists the open ones", () => {
  const sessions = new SessionRegistry(1);

  sessions.add("npm run dev", fakeProcess());

  const refused = sessions.canStart();

  assert.equal(refused.ok, false);
  assert.match(refused.ok ? "" : refused.reason, /npm run dev/);
});

test("paths stay inside the workspace", () => {
  assert.deepEqual(workspacePath("repo/a.cs"), { ok: true, value: "/workspace/repo/a.cs" });
  assert.deepEqual(workspacePath("/workspace/repo/"), { ok: true, value: "/workspace/repo" });
  assert.equal(workspacePath("../etc/passwd").ok, false);
  assert.equal(workspacePath("/workspace/../etc").ok, false);
  assert.equal(workspacePath("/workspaces/x").ok, false);
});
