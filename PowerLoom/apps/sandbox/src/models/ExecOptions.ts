import type { Readable } from "node:stream";

export interface ExecOptions {
  cwd?: string;
  /** Variables for this process only (a feed's sign-in for one restore step). */
  env?: string[];
  /** Sent to the process's stdin, then closed; without it stdin is not attached. */
  stdin?: Readable | Buffer;
  /** The stream is destroyed after this long if the process hasn't ended (a backstop behind `timeout`). */
  deadlineMs: number;
  /** Called with each chunk of stdout as it comes. */
  onStdout?: (chunk: Buffer) => void;
}
