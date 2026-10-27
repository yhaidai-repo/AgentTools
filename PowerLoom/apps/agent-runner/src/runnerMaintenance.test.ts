import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { it, mock } from "node:test";
import { RunnerServer } from "./runnerServer";
import { RunnerMaintenance } from "./RunnerMaintenance";

function invoke(runner: RunnerServer, method: string, url: string, body: unknown, input?: Readable) {
  const request = Object.assign(input ?? Readable.from([Buffer.from(JSON.stringify(body))]), { method, url, headers: {} }) as unknown as IncomingMessage;
  return new Promise<{ status: number; body: any }>((resolve) => {
    let status = 0;
    const response = { headersSent: false, destroyed: false, writableEnded: false,
      writeHead(code: number) { status = code; this.headersSent = true; },
      end(text: string) { this.writableEnded = true; resolve({ status, body: JSON.parse(text) }); },
      destroy() { this.destroyed = true; resolve({ status, body: null }); },
    };
    (runner as unknown as { server: Server }).server.emit("request", request, response as unknown as ServerResponse);
  });
}

it("maintenance preserves a pending accepted job, blocks new work and survives runner replacement", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "runner-maintenance-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  let finish!: () => void, executions = 0;
  const work = new Promise<void>((resolve) => { finish = resolve; });
  const file = join(folder, "maintenance.json"), owner = randomUUID();
  const runner = () => new RunnerServer(async () => { executions++; await work; }, async () => ({}) as never, async () => ({}) as never, {} as never, "synthetic", null, new RunnerMaintenance(file));
  const first = runner();
  assert.equal((await invoke(first, "POST", "/runs", { taskId: "AT-before-row", agentId: "synthetic" })).status, 202);
  const acquired = await invoke(first, "PUT", "/maintenance", { owner });
  assert.equal(acquired.status, 200);
  assert.equal(acquired.body.running, "AT-before-row");
  assert.equal((await invoke(first, "POST", "/runs", { taskId: "AT-queued", agentId: "synthetic" })).status, 409);
  assert.equal((await invoke(first, "PUT", "/maintenance", { owner })).status, 200);
  assert.equal((await invoke(first, "PUT", "/maintenance", { owner: randomUUID() })).status, 409);
  assert.equal((await invoke(first, "DELETE", "/maintenance", { owner: randomUUID() })).status, 409);
  const replaced = runner();
  assert.equal((await invoke(replaced, "GET", "/health", null)).body.maintenanceOwner, owner);
  assert.equal((await invoke(replaced, "POST", "/runs", { taskId: "AT-after-restart", agentId: "synthetic" })).status, 409);
  assert.equal(executions, 1);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await invoke(replaced, "DELETE", "/maintenance", { owner })).status, 200);
  assert.equal((await invoke(replaced, "POST", "/runs", { taskId: "AT-after-release", agentId: "synthetic" })).status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(executions, 2);
});

it("a request already reading its body cannot bypass an acquired barrier", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "runner-body-barrier-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  let executions = 0;
  const runner = new RunnerServer(async () => { executions++; }, async () => ({}) as never, async () => ({}) as never, {} as never, "synthetic", null, new RunnerMaintenance(join(folder, "lease.json")));
  const input = new Readable({ read() {} });
  const pending = invoke(runner, "POST", "/runs", null, input);
  const owner = randomUUID();
  assert.equal((await invoke(runner, "PUT", "/maintenance", { owner })).status, 200);
  input.push(JSON.stringify({ taskId: "AT-delayed-body", agentId: "synthetic" })); input.push(null);
  assert.equal((await pending).status, 409);
  assert.equal(executions, 0);
  assert.equal((await invoke(runner, "DELETE", "/maintenance", { owner })).status, 200);
});

it("malformed persistent leases and invalid owners fail without admitting work or changing ownership", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "runner-invalid-lease-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, "lease.json");
  const errorLog = mock.method(console, "error", () => {});
  t.after(() => errorLog.mock.restore());
  let executions = 0;
  const runner = new RunnerServer(async () => { executions++; }, async () => ({}) as never, async () => ({}) as never, {} as never, "synthetic", null, new RunnerMaintenance(file));
  assert.equal((await invoke(runner, "PUT", "/maintenance", { owner: "invalid" })).status, 400);
  await writeFile(file, "broken JSON");
  assert.equal((await invoke(runner, "POST", "/runs", { taskId: "AT-blocked", agentId: "synthetic" })).status, 500);
  assert.equal(executions, 0);
  assert.equal(await readFile(file, "utf8"), "broken JSON");
});
