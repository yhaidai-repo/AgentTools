import type { SessionOutput } from "@powerloom/sandbox";
import type { TtyProcess } from "../models/TtyProcess";
import { OutputBuffer } from "./OutputBuffer";

const BUFFER_CHARS = 1024 * 1024;
// How often a yield checks whether the process has ended.
const POLL_MS = 100;

// One process in a terminal (exec_command): its output is buffered while nobody reads, and each read waits up to its
// yield for more, or less when the process exits.
export class ExecSession {
  private readonly output = new OutputBuffer(BUFFER_CHARS);
  private ended = false;
  private exit: number | null = null;

  constructor(
    readonly id: string,
    readonly command: string,
    private readonly process: TtyProcess,
  ) {
    process.stream.on("data", (chunk: Buffer) => this.output.append(chunk.toString("utf8")));
    process.stream.once("end", () => void this.finish());
    process.stream.once("close", () => void this.finish());
    process.stream.once("error", () => void this.finish());
  }

  get isRunning(): boolean {
    return !this.ended;
  }

  write(chars: string): void {
    if (chars.length > 0 && !this.ended) {
      this.process.stream.write(chars);
    }
  }

  /** Waits up to `yieldMs` (less when the process ends), then returns what came since the last read. */
  async read(yieldMs: number, maxChars: number): Promise<SessionOutput> {
    await this.waitForEnd(yieldMs);

    const { text, truncated } = this.output.read(maxChars);

    return { sessionId: this.id, output: text, truncated, running: !this.ended, exitCode: this.exit };
  }

  close(): void {
    this.process.stream.destroy();
  }

  private async waitForEnd(yieldMs: number): Promise<void> {
    const until = Date.now() + yieldMs;

    while (!this.ended && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  private async finish(): Promise<void> {
    if (this.ended) {
      return;
    }

    this.ended = true;

    try {
      this.exit = await this.process.exitCode();
    } catch {
      this.exit = null;
    }
  }
}
