import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// PowerLoom's agents' doc reads in VaultUsage's log (user decision 2026-10-02: one log for Claude Code and PowerLoom), one JSON line
// per note in VaultUsage's log contract (D:/Projects/AgentTools/VaultUsage README). The file is the docs vault's
// `.usage/usage.jsonl`; paths are relative to the vault root.
export class DocUsageLog {
  constructor(private readonly logPath: string) {}

  async record(paths: string[], kind: "read" | "search", agentId: string, runId: number, at = new Date()): Promise<void> {
    const lines = paths.map((file) => JSON.stringify({
      ts: at.toISOString(),
      file,
      kind,
      agent: `powerloom:${agentId}`,
      subagent: null,
      session: `RUN-${runId}`,
      source: "PowerLoom",
      eventId: randomUUID(),
    }));

    await mkdir(dirname(this.logPath), { recursive: true });
    await appendFile(this.logPath, `${lines.join("\n")}\n`, "utf8");
  }
}
