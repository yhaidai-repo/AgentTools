import type { Duplex } from "node:stream";

// A process started in a terminal (a session): its two-way stream, and its exit code once it has ended.
export interface TtyProcess {
  stream: Duplex;
  exitCode(): Promise<number | null>;
}
