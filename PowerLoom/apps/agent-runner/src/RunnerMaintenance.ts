import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// The deployment lease lives on the persistent sessions volume, so a restarted runner remains closed to new jobs.
// All acceptance/lease decisions are synchronous on the runner's event loop, before a job is claimed.
export class RunnerMaintenance {
  constructor(private readonly file: string) {}

  owner(): string | null {
    try {
      const value: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      const owner = (value as { owner?: unknown } | null)?.owner;
      if (typeof owner !== "string" || !/^[a-f0-9-]{36}$/.test(owner)) throw new Error("Invalid deployment lease; maintenance remains closed.");
      return owner;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  acquire(owner: string): boolean {
    const previous = this.owner();
    if (previous !== null) return previous === owner;
    mkdirSync(dirname(this.file), { recursive: true });
    try {
      writeFileSync(this.file, JSON.stringify({ owner }), { flag: "wx", mode: 0o600 });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return this.owner() === owner;
      throw error;
    }
  }

  release(owner: string): boolean {
    const previous = this.owner();
    if (previous === null) return true;
    if (previous !== owner) return false;
    unlinkSync(this.file);
    return true;
  }
}
