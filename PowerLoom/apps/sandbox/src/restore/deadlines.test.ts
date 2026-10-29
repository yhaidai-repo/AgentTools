import assert from "node:assert/strict";
import { test } from "node:test";
import { RESTORE_CALL_TIMEOUT_MS } from "@powerloom/sandbox";
import { deadlineAfter, underTimeout } from "../docker/execDeadlines";
import { checkRestoreFitsClient, httpServerOptions, restoreAnswerMs } from "../http/requestTimeouts";
import type { SandboxConfig } from "../models/SandboxConfig";
import { RestoreBudget } from "./RestoreBudget";

const MINUTE = 60_000;

function configWith(restoreTimeoutMs: number, maxCommandMs = 10 * MINUTE): SandboxConfig {
  return { restoreTimeoutMs, maxCommandMs } as SandboxConfig;
}

function clock(startMs: number): { now: () => number; pass: (ms: number) => void } {
  let current = startMs;

  return { now: () => current, pass: (ms) => (current += ms) };
}

test("the server holds a request past the longest restore or command, not Node's 300 s", () => {
  const restoreLonger = httpServerOptions(configWith(15 * MINUTE));
  const commandLonger = httpServerOptions(configWith(5 * MINUTE, 20 * MINUTE));

  assert.equal(restoreLonger.requestTimeout, 15 * MINUTE + 30_000 + MINUTE);
  assert.equal(commandLonger.requestTimeout, 20 * MINUTE + 30_000 + MINUTE);
  assert.equal(restoreLonger.headersTimeout, undefined);
});

test("a restore's limits nest: container timeout < exec deadline < server request timeout < client timeout", () => {
  const config = configWith(15 * MINUTE);
  const timeoutSeconds = Number(underTimeout(["dotnet", "restore"], config.restoreTimeoutMs)[2].replace("s", ""));
  const execDeadlineMs = deadlineAfter(config.restoreTimeoutMs);
  const requestTimeoutMs = httpServerOptions(config).requestTimeout ?? 0;

  assert.equal(timeoutSeconds, 900);
  assert.ok(timeoutSeconds * 1000 < execDeadlineMs);
  assert.equal(restoreAnswerMs(config), execDeadlineMs);
  assert.ok(execDeadlineMs < requestTimeoutMs);
  assert.ok(requestTimeoutMs < RESTORE_CALL_TIMEOUT_MS);
});

test("a restore time the client wouldn't wait for is refused at start", () => {
  assert.doesNotThrow(() => checkRestoreFitsClient(configWith(15 * MINUTE)));
  assert.throws(() => checkRestoreFitsClient(configWith(29 * MINUTE)), /SANDBOX_RESTORE_TIMEOUT_MS/);
});

test("the queue wait, the copy and every step share one restore's time", () => {
  const time = clock(1_000_000);
  const budget = new RestoreBudget(15 * MINUTE, time.now);

  time.pass(4 * MINUTE);
  assert.equal(budget.remainingMs(), 11 * MINUTE);
  assert.equal(budget.deadlineWithin(10 * MINUTE), 10 * MINUTE);

  time.pass(10 * MINUTE);
  assert.equal(budget.deadlineWithin(10 * MINUTE), MINUTE + 30_000);
  assert.equal(budget.isUsedUp(), false);

  time.pass(MINUTE);
  assert.equal(budget.remainingMs(), 0);
  assert.equal(budget.isUsedUp(), true);
});
