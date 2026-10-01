import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Outcome } from "@adoa/core";
import type { CaptureResult } from "./models/CaptureResult";
import type { CliOutput } from "./models/CliOutput";
import type { CliResult } from "./models/CliResult";
import type { NewRegisterRecord } from "./models/NewRegisterRecord";
import type { RegisterRecord } from "./models/RegisterRecord";
import type { VaultDraft } from "./models/VaultDraft";

const CONFIG_FILE = "/tmp/vault-capture.config.json";
const TIMEOUT_MS = 60_000;

// The user's VaultCapture module (PowerShell CLI), which owns the docs vault's draft rules. Only the worker runs it.
export class VaultCaptureCli {
  private constructor(
    private readonly moduleHome: string,
    readonly vaultName: string,
  ) {}

  // `reason` names what needs the module, so a missing configuration fails the job with a clear message.
  static async fromEnv(reason: string): Promise<VaultCaptureCli> {
    const moduleHome = process.env.VAULT_CAPTURE_HOME;
    const vaultName = process.env.DOCS_VAULT_NAME;

    if (!moduleHome || !vaultName) {
      throw new Error(`${reason}, but VAULT_CAPTURE_HOME or DOCS_VAULT_NAME is not set`);
    }

    const cli = new VaultCaptureCli(moduleHome, vaultName);

    await writeFile(CONFIG_FILE, JSON.stringify({ vaults: [cli.vaultRoot()] }), "utf8");

    return cli;
  }

  async capture(request: object): Promise<CaptureResult> {
    const output = await this.run(["capture"], JSON.stringify(request));

    return output.ok ? (output.json as CaptureResult) : { ok: false, mode: "rejected", path: null, errors: [output.error] };
  }

  // Which names are still in draft/ (not yet merged). A failure here is unexpected and fails the job.
  async isDraft(names: string[]): Promise<Record<string, boolean>> {
    const output = await this.run(["is-draft", "-Vault", this.vaultName, ...names.flatMap((name) => ["-Name", name])]);
    const result = output.ok ? (output.json as { ok: boolean; drafts: Record<string, boolean>; errors: string[] }) : null;

    if (!result?.ok) {
      throw new Error(`VaultCapture is-draft failed: ${output.ok ? result?.errors.join("; ") : output.error}`);
    }

    return result.drafts;
  }

  // The drafts in the order a writer takes them: those whose source starts with `preferSource` first, then oldest first.
  async listDrafts(preferSource: string): Promise<VaultDraft[]> {
    const result = await this.query(["drafts", "-Vault", this.vaultName, "-PreferSource", preferSource]);

    return result.ok ? (result.drafts as VaultDraft[] | null) ?? [] : failQuery("drafts", result);
  }

  async listRegister(project: string, kind: NewRegisterRecord["kind"]): Promise<RegisterRecord[]> {
    const result = await this.query(["register", "-Vault", this.vaultName, "-Project", project, "-Kind", kind]);

    return result.ok ? (result.records as RegisterRecord[] | null) ?? [] : failQuery("register", result);
  }

  // Invalid input (unknown project, missing title) comes back as errors; the new record's id otherwise.
  async addRegisterRecord(record: NewRegisterRecord): Promise<Outcome<string>> {
    const result = await this.query(["register-add"], JSON.stringify({ vault: this.vaultName, ...record }));

    return result.ok ? { ok: true, value: String(result.id) } : { ok: false, error: result.errors.join("; ") };
  }

  private async query(args: string[], input = ""): Promise<CliResult> {
    const output = await this.run(args, input);

    return output.ok ? (output.json as CliResult) : { ok: false, errors: [output.error] };
  }

  // Draft paths as stored: relative to the docs vault (e.g. draft/pvs-topic.md).
  relativePath(path: string): string {
    return relative(this.vaultRoot(), path);
  }

  private vaultRoot(): string {
    return `/vaults/${this.vaultName}`;
  }

  private run(args: string[], input = ""): Promise<CliOutput> {
    return new Promise((resolve) => {
      const child = spawn("pwsh", ["-NoProfile", "-NonInteractive", "-File", join(this.moduleHome, "vault-capture.ps1"), ...args], {
        env: { ...process.env, VAULT_CAPTURE_CONFIG: CONFIG_FILE, NO_COLOR: "1" },
        timeout: TIMEOUT_MS,
      });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", (error) => resolve({ ok: false, error: `could not run VaultCapture: ${error.message}` }));
      child.on("close", (code) => resolve(parseOutput(stdout, stderr, code)));
      child.stdin.end(input, "utf8");
    });
  }
}

// The CLI prints one JSON result (also when rejecting, with exit code 1); anything else is a failure to report.
function parseOutput(stdout: string, stderr: string, code: number | null): CliOutput {
  try {
    return { ok: true, json: JSON.parse(stdout.trim().split("\n").pop() ?? "") };
  } catch {
    return { ok: false, error: `VaultCapture exited with ${code}: ${(stderr || stdout).trim().slice(0, 500)}` };
  }
}

// A listing that fails is unexpected (missing module, unreadable vault) and fails the job.
function failQuery(command: string, result: CliResult): never {
  throw new Error(`VaultCapture ${command} failed: ${result.errors.join("; ")}`);
}
