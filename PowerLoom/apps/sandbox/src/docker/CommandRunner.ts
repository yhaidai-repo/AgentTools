import { posix } from "node:path";
import { WORKSPACE, type CommandRequest, type CommandResult, type SessionOutput, type SessionStartRequest, type StdinRequest } from "@powerloom/sandbox";
import { workspacePath } from "../files/workspacePath";
import type { Outcome } from "../models/Outcome";
import { cutOutput } from "../sessions/cutOutput";
import type { SessionRegistry } from "../sessions/SessionRegistry";
import type { ContainerExec } from "./ContainerExec";
import type { DiskWatch } from "./DiskWatch";

const OUTPUT_DIR = `${WORKSPACE}/.out`;
const MAX_COMMAND_CHARS = 30_000;
const KILL_AFTER = "10s";
// The backstop behind `timeout`: the stream is dropped this long after the command's own limit.
const DEADLINE_MARGIN_MS = 30_000;
// `timeout` exits 124 on its signal, 137 when it had to SIGKILL.
const TIMED_OUT_CODES = new Set([124, 137]);

// The command is passed as an argument ("$1"), never pasted into the script, so no quoting of it can break out.
// pipefail: the command's own exit code, not tee's.
const COMMAND_SCRIPT = `mkdir -p "${OUTPUT_DIR}" && set -o pipefail && bash -lc "$1" < /dev/null 2>&1 | tee "$2"`;

// The sandbox's commands: one-shot ones that run to their end (run_command), and sessions in a terminal that keep
// running between calls (exec_command, write_stdin).
export class CommandRunner {
  private count = 0;

  constructor(
    private readonly exec: ContainerExec,
    private readonly disk: DiskWatch,
    private readonly sessions: SessionRegistry,
    private readonly maxCommandMs: number,
  ) {}

  async run(request: CommandRequest): Promise<Outcome<CommandResult>> {
    const cwd = await this.workingFolder(request.cwd);

    if (!cwd.ok) {
      return cwd;
    }

    return { ok: true, value: await this.runIn(cwd.value, request) };
  }

  async startSession(request: SessionStartRequest): Promise<Outcome<SessionOutput>> {
    const cwd = await this.workingFolder(request.cwd);
    const slot = this.sessions.canStart();

    if (!cwd.ok) {
      return cwd;
    }

    if (!slot.ok) {
      return slot;
    }

    const process = await this.exec.startTty(["bash", "-lc", request.command], cwd.value);
    const session = this.sessions.add(request.command, process);

    return this.readSession(session.id, request.yieldMs, request.maxChars);
  }

  async writeStdin(sessionId: string, request: StdinRequest): Promise<Outcome<SessionOutput>> {
    const session = this.sessions.find(sessionId);

    if (!session.ok) {
      return session;
    }

    session.value.write(request.chars);

    return this.readSession(sessionId, request.yieldMs, request.maxChars);
  }

  closeSessions(): void {
    this.sessions.closeAll();
  }

  // Where a command runs, as long as the workspace is under its disk cap.
  private async workingFolder(cwd: string | undefined): Promise<Outcome<string>> {
    const folder = workspacePath(cwd ?? WORKSPACE);

    if (!folder.ok) {
      return folder;
    }

    const room = await this.disk.check();

    return room.ok ? folder : room;
  }

  private async runIn(cwd: string, request: CommandRequest): Promise<CommandResult> {
    const timeoutMs = Math.min(request.timeoutMs, this.maxCommandMs);
    const outputFile = posix.join(OUTPUT_DIR, `${++this.count}.log`);
    const argv = ["timeout", `--kill-after=${KILL_AFTER}`, `${Math.ceil(timeoutMs / 1000)}s`, "bash", "-c", COMMAND_SCRIPT, "bash", request.command, outputFile];
    const started = Date.now();
    const result = await this.exec.run(argv, { cwd, deadlineMs: timeoutMs + DEADLINE_MARGIN_MS });
    const timedOut = TIMED_OUT_CODES.has(result.exitCode) && Date.now() - started >= timeoutMs;
    const output = cutOutput(result.stdout.toString("utf8") + result.stderr, MAX_COMMAND_CHARS, `; the whole output is in ${outputFile}`);

    return { exitCode: timedOut ? null : result.exitCode, output: output.text, truncated: output.truncated, timedOut, durationMs: Date.now() - started, outputFile };
  }

  private async readSession(sessionId: string, yieldMs: number, maxChars: number): Promise<Outcome<SessionOutput>> {
    const session = this.sessions.find(sessionId);

    if (!session.ok) {
      return session;
    }

    const output = await session.value.read(yieldMs, maxChars);

    this.sessions.forgetIfEnded(session.value);

    return { ok: true, value: output };
  }
}
