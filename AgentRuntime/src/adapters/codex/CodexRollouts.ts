import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import type { CodexTokenCount } from "./models/CodexTokenCount";
import { objectOf } from "./codexWindows";

export class CodexRollouts {
  constructor(private readonly codexHome: string) {}

  async files(): Promise<string[]> {
    const sessions = join(this.codexHome, "sessions");

    try {
      const files = await readdir(sessions, { recursive: true });

      return files.filter((file) => basename(file).startsWith("rollout-") && file.endsWith(".jsonl")).map((file) => join(sessions, file));
    } catch {
      return [];
    }
  }

  async findThread(threadId: string): Promise<string | null> {
    const suffix = "-" + threadId + ".jsonl";

    return (await this.files()).find((file) => basename(file).endsWith(suffix)) ?? null;
  }

  async *entries(path: string): AsyncIterable<Record<string, unknown>> {
    const input = createReadStream(path, { encoding: "utf8" });
    const lines = createInterface({ input, crlfDelay: Infinity });

    try {
      for await (const line of lines) {
        yield parseLine(line);
      }
    } finally {
      lines.close();
      input.destroy();
    }
  }

  async latestTokenCount(threadId?: string): Promise<CodexTokenCount | null> {
    try {
      return await this.readLatest(threadId);
    } catch {
      // Usage is optional: a rotating, partially written or unfamiliar rollout never fails a run.
      return null;
    }
  }

  private async readLatest(threadId?: string): Promise<CodexTokenCount | null> {
    const files = threadId ? [await this.findThread(threadId)] : await this.files();
    const counts = await Promise.all(files.filter((file): file is string => file !== null).map((file) => this.tokenCount(file)));

    return counts.filter((count): count is CodexTokenCount => count !== null).sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;
  }

  private async tokenCount(path: string): Promise<CodexTokenCount | null> {
    let latest: CodexTokenCount | null = null;

    for await (const entry of this.entries(path)) {
      latest = tokenCountOf(entry) ?? latest;
    }

    if (latest && latest.at.getTime() === 0) {
      latest.at = (await stat(path)).mtime;
    }

    return latest;
  }
}

export function parseLine(line: string): Record<string, unknown> {
  try {
    return objectOf(JSON.parse(line));
  } catch {
    return {};
  }
}

function tokenCountOf(entry: Record<string, unknown>): CodexTokenCount | null {
  const payload = objectOf(entry.payload);

  if (entry.type !== "event_msg" || payload.type !== "token_count" || !payload.rate_limits) {
    return null;
  }

  const at = typeof entry.timestamp === "string" ? new Date(entry.timestamp) : new Date(0);

  return { rateLimits: payload.rate_limits, at: Number.isFinite(at.getTime()) ? at : new Date(0) };
}
