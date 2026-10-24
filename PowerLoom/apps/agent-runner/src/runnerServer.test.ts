import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { CodexDeviceLogin, CodexHome } from "@powerloom/agents";
import type { RunnerCodex } from "./models/RunnerCodex";
import { RunnerServer } from "./runnerServer";

const NOT_USED = (async () => { throw new Error("not used here"); }) as never;

function serverWith(codex: RunnerCodex | null): RunnerServer {
  return new RunnerServer(NOT_USED, NOT_USED, NOT_USED, {} as never, codex);
}

async function call(port: number, method: string, path: string, body?: object): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("the runner's Codex routes", async () => {
  const root = await mkdtemp(join(tmpdir(), "runner-codex-"));
  const home = new CodexHome(join(root, "codex"));
  const fakeLogin = { onOutput: (listener: (text: string) => void) => listener("Open https://auth.openai.com/codex/device and enter ABCD-12345"), onExit: () => {}, kill: () => {} };
  const withCodex = serverWith({ home, login: new CodexDeviceLogin(home, { spawn: () => fakeLogin }) });
  const withoutCodex = serverWith(null);

  before(() => {
    withCodex.listen(32411);
    withoutCodex.listen(32412);
  });

  after(async () => {
    await withCodex.close();
    await withoutCodex.close();
    await rm(root, { recursive: true, force: true });
  });

  it("say Codex isn't set up when the runner has no CODEX_HOME", async () => {
    const answer = await call(32412, "GET", "/codex/status");

    assert.equal(answer.status, 404);
    assert.match(String(answer.body.error), /CODEX_HOME is not set/);
  });

  it("connect with a login file and disconnect again", async () => {
    assert.deepEqual((await call(32411, "GET", "/codex/status")).body, { connected: false });
    assert.equal((await call(32411, "PUT", "/codex/login-file", { authJson: '{"tokens":{}}' })).status, 200);
    assert.deepEqual((await call(32411, "GET", "/codex/status")).body, { connected: true });
    assert.equal((await call(32411, "DELETE", "/codex/login")).status, 200);
    assert.deepEqual((await call(32411, "GET", "/codex/status")).body, { connected: false });
  });

  it("refuse a login file that isn't JSON", async () => {
    const answer = await call(32411, "PUT", "/codex/login-file", { authJson: "nope" });

    assert.equal(answer.status, 400);
    assert.match(String(answer.body.error), /isn't a Codex login file/);
  });

  it("start the device sign-in with its link and code, then report it pending", async () => {
    const started = await call(32411, "POST", "/codex/login/start");
    const status = await call(32411, "GET", "/codex/login/status");

    assert.equal(started.body.verificationUri, "https://auth.openai.com/codex/device");
    assert.equal(started.body.userCode, "ABCD-12345");
    assert.equal(status.body.status, "pending");
  });

  it("cancel a pending sign-in", async () => {
    await call(32411, "POST", "/codex/login/start");
    const cancelled = await call(32411, "POST", "/codex/login/cancel");
    const status = await call(32411, "GET", "/codex/login/status");

    assert.equal(cancelled.body.status, "none");
    assert.equal(status.body.status, "none");
  });
});
