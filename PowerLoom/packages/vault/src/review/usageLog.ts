import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { VaultUsageEvent } from "../models/VaultUsageEvent";

// VaultUsage's log contract (its README): one JSON object per line in <vault>/.usage/usage.jsonl. Its PowerShell report
// isn't in the containers, so PowerLoom reads the log itself.
const LOG_FILE = ".usage/usage.jsonl";
// Claude Code reads the vault mostly through shell commands (cat, sed, grep), logged as `shell` (user decision 2026-10-02:
// they count, like in VaultUsage's own report; a few are only mentions). Writes alone don't.
export const USE_KINDS: VaultUsageEvent["kind"][] = ["read", "search", "shell"];

export async function readUsageEvents(root: string): Promise<VaultUsageEvent[]> {
  const text = await readFile(join(root, LOG_FILE), "utf8").catch(() => "");

  return text.split("\n").filter((line) => line.trim()).map(parseLine).filter((event): event is VaultUsageEvent => event !== null);
}

export function isUse(event: VaultUsageEvent): boolean {
  return USE_KINDS.includes(event.kind);
}

function parseLine(line: string): VaultUsageEvent | null {
  try {
    const raw = JSON.parse(line) as { ts?: string; file?: string; kind?: VaultUsageEvent["kind"]; agent?: string };

    return raw.ts && raw.file && raw.kind ? { at: new Date(raw.ts), file: raw.file, kind: raw.kind, agent: raw.agent ?? "unknown" } : null;
  } catch {
    return null;
  }
}
