import { randomBytes } from "node:crypto";
import type { Outcome } from "../models/Outcome";
import type { TtyProcess } from "../models/TtyProcess";
import { ExecSession } from "./ExecSession";

// A sandbox's sessions. A session whose process has ended stays for one more read (its exit code), then it goes.
export class SessionRegistry {
  private readonly sessions = new Map<string, ExecSession>();

  constructor(private readonly maxSessions: number) {}

  /** Refused when the sandbox already has its most sessions running; the answer lists them. */
  canStart(): Outcome<null> {
    this.dropEnded();

    if (this.sessions.size < this.maxSessions) {
      return { ok: true, value: null };
    }

    const open = [...this.sessions.values()].map((session) => `${session.id}: ${session.command}`).join("; ");

    return { ok: false, reason: `${this.maxSessions} sessions are open (${open}): end one (write "\\u0003" to it, or exit) before starting another` };
  }

  add(command: string, process: TtyProcess): ExecSession {
    const session = new ExecSession(randomBytes(4).toString("hex"), command, process);

    this.sessions.set(session.id, session);

    return session;
  }

  find(id: string): Outcome<ExecSession> {
    const session = this.sessions.get(id);

    return session ? { ok: true, value: session } : { ok: false, reason: `No session ${id}: it ended and its exit code was read, or the sandbox was reopened. Start it again with exec_command.` };
  }

  /** After a read that reported the end, the session is forgotten. */
  forgetIfEnded(session: ExecSession): void {
    if (!session.isRunning) {
      this.sessions.delete(session.id);
    }
  }

  closeAll(): void {
    this.sessions.forEach((session) => session.close());
    this.sessions.clear();
  }

  private dropEnded(): void {
    [...this.sessions.values()].filter((session) => !session.isRunning).forEach((session) => this.sessions.delete(session.id));
  }
}
