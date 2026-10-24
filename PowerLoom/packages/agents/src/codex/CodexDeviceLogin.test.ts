import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CodexDeviceLogin } from "./CodexDeviceLogin";
import { CodexHome } from "./CodexHome";
import type { CodexLoginProcess } from "./models/CodexLoginProcess";

class FakeLogin implements CodexLoginProcess {
  killed = false;
  private output: (text: string) => void = () => {};
  private exit: (code: number | null) => void = () => {};

  onOutput(listener: (text: string) => void): void {
    this.output = listener;
  }

  onExit(listener: (code: number | null) => void): void {
    this.exit = listener;
  }

  kill(): void {
    this.killed = true;
  }

  print(text: string): void {
    this.output(text);
  }

  end(code: number | null): void {
    this.exit(code);
  }
}

function loginWith(fakes: FakeLogin[], options: { codeWaitMs?: number; signInTimeoutMs?: number } = {}): { login: CodexDeviceLogin; spawned: string[] } {
  const spawned: string[] = [];
  const home = new CodexHome("/codex-home");
  const login = new CodexDeviceLogin(home, { spawn: (path) => {
    spawned.push(path);

    return fakes[spawned.length - 1];
  }, codeWaitMs: 200, ...options });

  return { login, spawned };
}

describe("Connect Codex's device sign-in", () => {
  it("answers with the link and code, then is done when the CLI ends well", async () => {
    const fake = new FakeLogin();
    const { login, spawned } = loginWith([fake]);
    const starting = login.start();

    fake.print("Open https://auth.openai.com/codex/device and enter ABCD-12345\n");

    assert.deepEqual(await starting, { verificationUri: "https://auth.openai.com/codex/device", userCode: "ABCD-12345", output: "Open https://auth.openai.com/codex/device and enter ABCD-12345" });
    assert.deepEqual(spawned, ["/codex-home"]);
    assert.equal(login.status().status, "pending");
    fake.end(0);
    assert.deepEqual(login.status(), { status: "done", error: null, output: "Open https://auth.openai.com/codex/device and enter ABCD-12345\n" });
  });

  it("runs one sign-in at a time", async () => {
    const fake = new FakeLogin();
    const { login, spawned } = loginWith([fake]);

    fake.print("");
    const first = login.start();

    fake.print("https://auth.openai.com/codex/device ABCD-12345");
    await first;
    await login.start();

    assert.equal(spawned.length, 1);
  });

  it("shows the raw text when the link or the code can't be read", async () => {
    const fake = new FakeLogin();
    const { login } = loginWith([fake]);
    const starting = login.start();

    fake.print("Something new the parser doesn't know");

    assert.deepEqual(await starting, { verificationUri: null, userCode: null, output: "Something new the parser doesn't know" });
  });

  it("fails with the CLI's own words when it ends before a code, e.g. device codes switched off", async () => {
    const fake = new FakeLogin();
    const { login } = loginWith([fake]);
    const starting = login.start();

    fake.print("Error logging in with device code: device code authorization is disabled");
    fake.end(1);

    await assert.rejects(starting, /device code authorization is disabled/);
    assert.equal(login.status().status, "failed");
  });

  it("cancels a pending sign-in, kills the CLI and starts afresh on the next Connect", async () => {
    const first = new FakeLogin();
    const second = new FakeLogin();
    const { login, spawned } = loginWith([first, second]);
    const starting = login.start();

    first.print("https://auth.openai.com/codex/device ABCD-12345");
    await starting;

    const cancelled = login.cancel();
    const again = login.start();

    second.print("https://auth.openai.com/codex/device WXYZ-9876");
    await again;

    assert.equal(cancelled.status, "none");
    assert.equal(first.killed, true);
    assert.equal(spawned.length, 2);
  });

  it("kills an abandoned sign-in when it times out", async () => {
    const fake = new FakeLogin();
    const { login } = loginWith([fake], { signInTimeoutMs: 200 });
    const starting = login.start();

    fake.print("https://auth.openai.com/codex/device ABCD-12345");
    await starting;
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(fake.killed, true);
    assert.deepEqual(login.status().error, "The sign-in timed out: start it again.");
  });
});
