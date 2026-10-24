import { deviceCodeOf, plainText } from "./deviceCodeOf";
import type { CodexHome } from "./CodexHome";
import type { CodexDeviceLoginOptions } from "./models/CodexDeviceLoginOptions";
import type { CodexLoginProcess } from "./models/CodexLoginProcess";
import type { CodexLoginStart } from "./models/CodexLoginStart";
import type { CodexLoginStatus } from "./models/CodexLoginStatus";

const CODE_WAIT_MS = 20_000;
const SIGN_IN_TIMEOUT_MS = 15 * 60_000;

// Connect Codex (Settings → AI providers): `codex login --device-auth` in PowerLoom's Codex home. One sign-in at a time;
// it answers as soon as the link and code are printed and finishes in the background; an abandoned one is killed.
// Needs "Device code authorization" switched on in ChatGPT → Settings → Security.
export class CodexDeviceLogin {
  private child: CodexLoginProcess | null = null;
  private output = "";
  private state: CodexLoginStatus["status"] = "none";
  private error: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly home: CodexHome, private readonly options: CodexDeviceLoginOptions) {}

  /** The link and code; a second start while one is pending answers the pending one. Throws when the CLI ends first. */
  async start(): Promise<CodexLoginStart> {
    if (this.state !== "pending") {
      this.launch();
    }

    await this.codeOrEnd();

    if (this.state === "failed") {
      throw new Error(this.error ?? "The Codex sign-in ended.");
    }

    return this.started();
  }

  status(): CodexLoginStatus {
    return { status: this.state, error: this.error, output: plainText(this.output) };
  }

  /** Stops a pending sign-in, keeping any login there is: Connect Codex can be started again. */
  cancel(): CodexLoginStatus {
    if (this.state === "pending") {
      this.clearTimer();
      this.child?.kill();
      this.child = null;
      this.state = "none";
      this.error = null;
    }

    return this.status();
  }

  /** Stops a pending sign-in and removes the login. */
  async signOut(): Promise<void> {
    this.end("failed", "Disconnected.");
    await this.home.signOut();
  }

  private launch(): void {
    const child = this.options.spawn(this.home.path);

    this.child = child;
    this.output = "";
    this.error = null;
    this.state = "pending";
    child.onOutput((text) => {
      this.output += text;
    });
    child.onExit((code) => this.exited(child, code));
    this.timer = setTimeout(() => this.end("failed", "The sign-in timed out: start it again."), this.options.signInTimeoutMs ?? SIGN_IN_TIMEOUT_MS);
    // A pending sign-in must not keep the runner from stopping.
    this.timer.unref();
  }

  private exited(child: CodexLoginProcess, code: number | null): void {
    if (child !== this.child) {
      return;
    }

    this.child = null;
    this.end(code === 0 ? "done" : "failed", code === 0 ? null : `codex login ended: ${plainText(this.output).trim() || `exit code ${code}`}`);
  }

  private end(state: "done" | "failed", error: string | null): void {
    if (this.state !== "pending") {
      return;
    }

    this.state = state;
    this.error = error;
    this.clearTimer();
    this.child?.kill();
    this.child = null;
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async codeOrEnd(): Promise<void> {
    const deadline = Date.now() + (this.options.codeWaitMs ?? CODE_WAIT_MS);

    while (this.isWaiting() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private isWaiting(): boolean {
    return this.state === "pending" && deviceCodeOf(this.output) === null;
  }

  private started(): CodexLoginStart {
    const code = deviceCodeOf(this.output);

    return { verificationUri: code?.verificationUri ?? null, userCode: code?.userCode ?? null, output: plainText(this.output).trim() };
  }
}
