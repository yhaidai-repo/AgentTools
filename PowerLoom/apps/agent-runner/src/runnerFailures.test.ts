import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { afterEach, it, mock } from "node:test";
import { RunnerServer } from "./runnerServer";

afterEach(() => mock.restoreAll());
const failure = async () => { throw new Error("synthetic dependency failure"); };

function invoke(runner: RunnerServer, method: string, url: string, body: unknown, failBody = false, failEnd = false) {
  const input = failBody ? new Readable({ read() { this.destroy(new Error("synthetic body read failure")); } }) : Readable.from([Buffer.from(JSON.stringify(body))]);
  const request = Object.assign(input, { method, url, headers: {}, aborted: failBody }) as unknown as IncomingMessage;
  let status = 0;
  let headers = 0;
  let finish: (result: { status: number; headers: number; text: string; destroyed: boolean }) => void;
  const finished = new Promise<{ status: number; headers: number; text: string; destroyed: boolean }>((resolve) => { finish = resolve; });
  const response = {
    headersSent: false, destroyed: false, writableEnded: false,
    writeHead(code: number) { status = code; headers++; this.headersSent = true; },
    end(text: string) { if (failEnd) throw new Error("synthetic socket failure"); this.writableEnded = true; finish({ status, headers, text, destroyed: false }); },
    destroy() { this.destroyed = true; finish({ status, headers, text: "", destroyed: true }); },
  };
  (runner as unknown as { server: Server }).server.emit("request", request, response as unknown as ServerResponse);
  return finished;
}

it("returns a controlled response when async dependencies fail, without exposing their errors", async () => {
  mock.method(console, "error", () => {});
  const runner = new RunnerServer(failure, failure, failure, { signOut: failure } as never, "synthetic");
  for (const [method, path, body] of [["POST", "/sql/test", { connectionString: "synthetic" }], ["POST", "/devhub/test", { url: "synthetic", token: "synthetic" }], ["DELETE", "/azure/login?vault=personal", {}]] as const) {
    const result = await invoke(runner, method, path, body);
    assert.equal(result.status, 500);
    assert.equal(result.headers, 1);
    assert.doesNotMatch(result.text, /synthetic dependency/);
  }
});

it("closes aborted bodies or a response whose headers have already been sent", async () => {
  mock.method(console, "error", () => {});
  const runner = new RunnerServer(failure, failure, failure, {} as never, "synthetic");
  const aborted = await invoke(runner, "POST", "/sql/test", {}, true);
  assert.equal(aborted.destroyed, true);
  assert.equal(aborted.headers, 0);
  const ended = await invoke(runner, "GET", "/health", {}, false, true);
  assert.equal(ended.destroyed, true);
  assert.equal(ended.headers, 1);
});

it("consumes rejected background jobs and accepts the next job", async () => {
  mock.method(console, "error", () => {});
  let runs = 0;
  const runner = new RunnerServer(async () => { runs++; throw new Error("synthetic run failure"); }, failure, failure, {} as never, "synthetic");
  for (let n = 0; n < 2; n++) {
    const result = await invoke(runner, "POST", "/runs", { taskId: `AT-${n}`, agentId: "synthetic" });
    assert.equal(result.status, 202);
    await new Promise((resolve) => setImmediate(resolve));
    const health = await invoke(runner, "GET", "/health", {});
    assert.equal(JSON.parse(health.text).running, null);
  }
  assert.equal(runs, 2);
});

it("keeps an active job alive through an unrelated settings failure", async () => {
  mock.method(console, "error", () => {});
  let finish: () => void;
  const work = new Promise<void>((resolve) => { finish = resolve; });
  const runner = new RunnerServer(() => work, failure, failure, {} as never, "synthetic");
  await invoke(runner, "POST", "/runs", { taskId: "AT-active", agentId: "synthetic" });
  assert.equal((await invoke(runner, "POST", "/sql/test", { connectionString: "synthetic" })).status, 500);
  assert.equal(JSON.parse((await invoke(runner, "GET", "/health", {})).text).running, "AT-active");
  finish!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.parse((await invoke(runner, "GET", "/health", {})).text).running, null);
});

it("still runs and frees a claimed job when its acceptance response cannot be sent", async () => {
  mock.method(console, "error", () => {});
  let ran = 0;
  const runner = new RunnerServer(async () => { ran++; }, failure, failure, {} as never, "synthetic");
  const result = await invoke(runner, "POST", "/runs", { taskId: "AT-response", agentId: "synthetic" }, false, true);
  assert.equal(result.destroyed, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, 1);
  assert.equal(JSON.parse((await invoke(runner, "GET", "/health", {})).text).running, null);
});
