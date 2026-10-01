import { vaultCapture, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

type CaptureRow = typeof vaultCapture.$inferSelect;

interface CaptureResult {
  ok: boolean;
  mode: "created" | "appended" | "rejected";
  path: string | null;
  errors: string[];
}

const CONFIG_FILE = "/tmp/vault-capture.config.json";
const TIMEOUT_MS = 60_000;

// Saves the PBI's pending captures through the VaultCapture module (its CLI), which owns the vault rules.
// Every result is stored on the capture; a rejection is logged and shown on the run page, never dropped.
export async function writeCaptures(db: AdoaDb, adoId: number): Promise<void> {
  const moduleHome = process.env.VAULT_CAPTURE_HOME;
  const vaultName = process.env.DOCS_VAULT_NAME;

  if (!moduleHome || !vaultName) {
    return;
  }

  const pending = await db.select().from(vaultCapture).where(and(eq(vaultCapture.pbiId, adoId), eq(vaultCapture.status, "pending")));

  await writeFile(CONFIG_FILE, JSON.stringify({ vaults: [vaultRoot(vaultName)] }), "utf8");

  for (const capture of pending) {
    await saveCapture(db, moduleHome, vaultName, capture);
  }
}

async function saveCapture(db: AdoaDb, moduleHome: string, vaultName: string, capture: CaptureRow): Promise<void> {
  const request = {
    vault: vaultName,
    project: capture.project,
    name: capture.name,
    title: capture.title,
    source: `session finding: adoa ${capture.itemId ?? "agent"} run RUN-${capture.runId} (PBI-${capture.pbiId})`,
    target: capture.target,
    captured: capture.captured,
    assumptions: capture.assumptions,
    toFill: capture.toFill,
  };
  const result = await runCapture(moduleHome, JSON.stringify(request));
  const filePath = result.ok && result.path ? relative(vaultRoot(vaultName), result.path) : null;

  if (!result.ok) {
    console.error(`VaultCapture rejected CAP-${capture.id} (${capture.name}): ${result.errors.join("; ")}`);
  }

  await db.update(vaultCapture).set({ status: result.mode, errors: result.errors, filePath }).where(eq(vaultCapture.id, capture.id));
}

function vaultRoot(vaultName: string): string {
  return `/vaults/${vaultName}`;
}

function runCapture(moduleHome: string, input: string): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const child = spawn("pwsh", ["-NoProfile", "-NonInteractive", "-File", join(moduleHome, "vault-capture.ps1"), "capture"], {
      env: { ...process.env, VAULT_CAPTURE_CONFIG: CONFIG_FILE, NO_COLOR: "1" },
      timeout: TIMEOUT_MS,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve(failed(`could not run VaultCapture: ${error.message}`)));
    child.on("close", (code) => resolve(parseResult(stdout, stderr, code)));
    child.stdin.end(input, "utf8");
  });
}

// The CLI prints one JSON result (also when rejecting, with exit code 1); anything else is a failure to report.
function parseResult(stdout: string, stderr: string, code: number | null): CaptureResult {
  try {
    return JSON.parse(stdout.trim().split("\n").pop() ?? "") as CaptureResult;
  } catch {
    return failed(`VaultCapture exited with ${code}: ${(stderr || stdout).trim().slice(0, 500)}`);
  }
}

function failed(message: string): CaptureResult {
  return { ok: false, mode: "rejected", path: null, errors: [message] };
}
