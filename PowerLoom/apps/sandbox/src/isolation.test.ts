import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { after, before, describe, it } from "node:test";
import { SandboxClient } from "@powerloom/sandbox";

// Against a running sandbox service and real Docker (opt-in): SANDBOX_IT_URL and SANDBOX_IT_TOKEN. Proves the
// isolation the design relies on, not just the code paths.
const url = process.env.SANDBOX_IT_URL;
const client = new SandboxClient(url ?? "", process.env.SANDBOX_IT_TOKEN ?? "");
const owner = `powerloom-it-${Date.now()}`;
let id = "";

async function run(command: string, timeoutMs = 60_000) {
  const answer = await client.run(id, { command, timeoutMs });

  assert.ok(answer.ok, answer.ok ? "" : answer.message);

  return answer.value;
}

function demoRepo(): ReadableStream<Uint8Array> {
  const root = mkdtempSync(join(tmpdir(), "sandbox-it-"));

  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "app.txt"), "one\ntwo\n");

  return Readable.toWeb(spawn("tar", ["-c", "-C", root, "."]).stdout) as ReadableStream<Uint8Array>;
}

describe("sandbox isolation (real Docker)", { skip: !url }, () => {
  before(async () => {
    const opened = await client.open({ owner, ttlMinutes: 15 });

    assert.ok(opened.ok, opened.ok ? "" : opened.message);
    id = opened.value.id;

    const uploaded = await client.uploadRepo(id, "demo", demoRepo(), "base test");

    assert.ok(uploaded.ok, uploaded.ok ? "" : uploaded.message);
    assert.equal(uploaded.value.files, 1);
  });

  after(async () => {
    await client.removeOwned(owner);
  });

  it("copies the repo in as a git repo of its own, with no remote", async () => {
    const result = await run("cd demo && git log --oneline | wc -l && git remote | wc -l");

    assert.equal(result.output.trim(), "1\n0");
  });

  it("runs as an ordinary user with no capabilities, on a read-only root", async () => {
    const result = await run("id -u; grep CapEff /proc/self/status | awk '{print $2}'; touch /etc/x 2>/dev/null && echo root-writable || echo root-read-only; touch /workspace/ok && echo workspace-writable");

    assert.equal(result.output.trim(), "1000\n0000000000000000\nroot-read-only\nworkspace-writable");
  });

  it("has no network but loopback, and none of the service's variables", async () => {
    const result = await run("ls /sys/class/net; getent hosts example.com >/dev/null && echo dns || echo no-dns; env | grep -cE '^(SANDBOX_|DOCKER_|CLAUDE|CODEX|ANTHROPIC|OPENAI|DATABASE_URL|CONFLUENCE)' || true");

    assert.equal(result.output.trim(), "lo\nno-dns\n0");
  });

  it("stops a process tree at the pids limit", async () => {
    const result = await run("for i in $(seq 600); do sleep 20 & done 2>&1 | grep -c 'Resource temporarily unavailable' || true; pkill -f 'sleep 20'; true", 60_000);

    assert.ok(Number(result.output.trim().split("\n")[0]) > 0, result.output);
  });

  it("kills a command at its timeout", async () => {
    const result = await run("sleep 30", 2_000);

    assert.equal(result.timedOut, true);
    assert.equal(result.exitCode, null);
  });

  it("keeps a shell's state in a session, and reaches a server in another one over loopback", async () => {
    const shell = await client.startSession(id, { command: "bash", yieldMs: 500, maxChars: 4_000 });

    assert.ok(shell.ok && shell.value.running);

    await client.writeStdin(id, shell.value.sessionId, { chars: "cd /workspace/demo\n", yieldMs: 300, maxChars: 4_000 });

    const pwd = await client.writeStdin(id, shell.value.sessionId, { chars: "pwd\n", yieldMs: 500, maxChars: 4_000 });
    const server = await client.startSession(id, { command: "python3 -m http.server 8765", cwd: "/workspace/demo", yieldMs: 1_500, maxChars: 4_000 });
    const fetched = await run("python3 -c \"import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8765/src/app.txt').read().decode().split()[0])\"");
    const stopped = server.ok ? await client.writeStdin(id, server.value.sessionId, { chars: "\u0003", yieldMs: 2_000, maxChars: 4_000 }) : null;

    assert.ok(pwd.ok);
    assert.match(pwd.value.output, /\/workspace\/demo/);
    assert.equal(fetched.output.trim(), "one");
    assert.equal(stopped?.ok && stopped.value.running, false);
  });

  it("edits with a patch and a string edit, and git sees the changes", async () => {
    const patched = await client.applyPatch(id, "*** Begin Patch\n*** Update File: demo/src/app.txt\n@@\n one\n-two\n+three\n*** Add File: demo/src/new.txt\n+new\n*** End Patch");
    const edited = await client.edit(id, { path: "demo/src/app.txt", oldString: "one", newString: "uno", replaceAll: false });
    const diff = await run("cd demo && git add -A && git diff --cached --stat | tail -1");

    assert.ok(patched.ok, patched.ok ? "" : patched.message);
    assert.ok(edited.ok, edited.ok ? "" : edited.message);
    assert.match(diff.output, /2 files changed/);
  });

  it("refuses a file outside the workspace", async () => {
    const written = await client.writeFile(id, { path: "/etc/passwd", content: "x" });

    assert.equal(written.ok, false);
    assert.equal(written.ok ? "" : written.failure, "refused");
  });

  it("is gone once removed", async () => {
    await client.removeOwned(owner);

    const answer = await client.run(id, { command: "true", timeoutMs: 5_000 });

    assert.equal(answer.ok, false);
    assert.match(answer.ok ? "" : answer.message, /No sandbox/);
  });
});
