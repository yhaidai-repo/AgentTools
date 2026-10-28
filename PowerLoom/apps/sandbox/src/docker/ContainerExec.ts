import { PassThrough, type Duplex } from "node:stream";
import type Docker from "dockerode";
import type { ExecOptions } from "../models/ExecOptions";
import type { ExecResult } from "../models/ExecResult";
import type { TtyProcess } from "../models/TtyProcess";
import { SANDBOX_USER } from "./sandboxContainerOptions";

// Runs processes in one sandbox container as its user (never root), through the Docker API's exec.
export class ContainerExec {
  constructor(
    private readonly docker: Docker,
    private readonly containerId: string,
  ) {}

  /** Runs `argv` to its end and collects its output; stdout and stderr stay apart. */
  async run(argv: string[], options: ExecOptions): Promise<ExecResult> {
    const exec = await this.container().exec({ Cmd: argv, User: SANDBOX_USER, WorkingDir: options.cwd, AttachStdout: true, AttachStderr: true, AttachStdin: options.stdin !== undefined, Tty: false });
    const stream = await exec.start({ hijack: true, stdin: options.stdin !== undefined });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    this.docker.modem.demuxStream(stream, collector(stdout, options.onStdout), collector(stderr));
    sendStdin(stream, options.stdin);
    await ended(stream, options.deadlineMs);

    const inspected = await exec.inspect();

    return { exitCode: inspected.ExitCode ?? -1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString("utf8") };
  }

  /** Starts `argv` in a terminal and hands back its stream: what it prints, and its stdin. */
  async startTty(argv: string[], cwd: string): Promise<TtyProcess> {
    const exec = await this.container().exec({ Cmd: argv, User: SANDBOX_USER, WorkingDir: cwd, AttachStdout: true, AttachStderr: true, AttachStdin: true, Tty: true, Env: ["TERM=dumb"] });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

    return { stream, exitCode: async () => (await exec.inspect()).ExitCode ?? null };
  }

  private container(): Docker.Container {
    return this.docker.getContainer(this.containerId);
  }
}

function collector(chunks: Buffer[], onChunk?: (chunk: Buffer) => void): PassThrough {
  const target = new PassThrough();

  target.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    onChunk?.(chunk);
  });

  return target;
}

// Closing our side of the stream is the process's end of input.
function sendStdin(stream: Duplex, stdin: ExecOptions["stdin"]): void {
  if (stdin === undefined) {
    return;
  }

  if (Buffer.isBuffer(stdin)) {
    stream.end(stdin);

    return;
  }

  stdin.pipe(stream);
}

function ended(stream: Duplex, deadlineMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => stream.destroy(new Error(`the process didn't end within ${deadlineMs} ms`)), deadlineMs);
    const finish = (error?: Error) => {
      clearTimeout(deadline);

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    stream.once("end", () => finish());
    stream.once("close", () => finish());
    stream.once("error", finish);
  });
}
