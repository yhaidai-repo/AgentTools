import { DocUsageLog } from "@powerloom/agents";
import { runInVault } from "@powerloom/core";
import type { StoredTraceEvent, UsageStore } from "@agenttools/usage";
import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, gte } from "drizzle-orm";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, posix, relative } from "node:path";

export async function backfillDocUsage(db: PowerLoomDb, usage: UsageStore, vault: string, vaultsRoot = "/vaults"): Promise<{ reads: number; runs: number }> {
  const logPath = await validatedLogPath(vaultsRoot, vault);
  const log = new DocUsageLog(logPath);
  const logged = await loggedRuns(logPath);
  const since = new Date(Date.now() - 30 * 86400000);
  const runs = (await db.select({ id: agentRun.id, stage: agentRun.stage }).from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(gte(agentRun.startedAt, since), runInVault(vault))))
    .filter((run) => !logged.has(`RUN-${run.id}`));
  let reads = 0;
  for (const run of runs) {
    for (const event of await usage.trace(String(run.id))) {
      const path = docPath(event);
      if (event.type === "tool_call" && event.payload.name === "read_doc" && path) {
        await log.record([path], "read", run.stage, `RUN-${run.id}`, event.at);
        reads++;
      }
    }
  }
  return { reads, runs: runs.length };
}

async function validatedLogPath(vaultsRoot: string, vault: string): Promise<string> {
  if (!vault || vault === "." || vault === ".." || /[\\/:\x00-\x1f]/.test(vault) || /[. ]$/.test(vault)) throw new Error("Invalid vault folder name.");
  const base = await realpath(vaultsRoot);
  const root = await realpath(join(base, vault));
  if (!samePath(relative(base, root), vault)) throw new Error("Vault folder escapes its configured mount.");
  for (const path of [join(root, ".usage"), join(root, ".usage", "usage.jsonl")]) {
    const entry = await lstat(path).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
    if (entry && !samePath(await realpath(path), path)) throw new Error("Usage log aliases are not allowed.");
  }
  return join(root, ".usage", "usage.jsonl");
}

function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function docPath(event: StoredTraceEvent): string {
  const input = event.payload.input as { path?: unknown } | undefined;
  if (typeof input?.path !== "string") return "";
  const path = posix.normalize(input.path.replaceAll("\\", "/"));
  return path === "." || path.startsWith("/") || path === ".." || path.startsWith("../") || /^[a-z]:/i.test(path) ? "" : path;
}

async function loggedRuns(path: string): Promise<Set<string>> {
  const text = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return ""; throw error; });
  const rows = text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { source?: string; session?: string });
  return new Set(rows.filter((row) => row.source === "PowerLoom").map((row) => row.session ?? ""));
}
