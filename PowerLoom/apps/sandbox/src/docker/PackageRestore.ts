import { posix } from "node:path";
import type { Readable } from "node:stream";
import type Docker from "dockerode";
import { PACKAGES, type FeedCredential, type RestoreResult, type RestoreStepResult } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { RepoProbe } from "../models/RepoProbe";
import type { RestoreStep } from "../models/RestoreStep";
import type { SandboxConfig } from "../models/SandboxConfig";
import type { SandboxInfo } from "@powerloom/sandbox";
import { npmrcAuth, nugetCredentialEnv, nugetSourcesOf } from "../restore/feedCredentials";
import { probeRepo, restoreTarget } from "../restore/probeRepo";
import { restorePlanOf } from "../restore/restorePlan";
import { cutOutput } from "../sessions/cutOutput";
import { ContainerExec } from "./ContainerExec";
import { proxyTokenOf } from "../proxy/proxyToken";
import { RESTORE_WORK, restoreContainerOptions } from "./sandboxContainerOptions";

const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const STEP_OUTPUT_CHARS = 8_000;
const SETUP_DEADLINE_MS = 10 * 60_000;
const SOURCES_DEADLINE_MS = 60_000;
const EXTRACT_SCRIPT = `mkdir -p -- "$1" && tar -x -C "$1"`;
const NPMRC_SCRIPT = `cat > "$HOME/.npmrc"`;
// A pass outlives its restore's time limit by this much, so a slow last step isn't cut off at the proxy.
const PASS_MARGIN_MS = 5 * 60_000;

// A restore (design agent-sandbox, phase 3): in a container of its own, on the unchanged copy of a repo (the tar the
// runner sends, never the agent's edited workspace), with the network through the egress proxy and the feeds'
// sign-ins only there. Its packages land in the sandbox's packages volume, which the agent's container reads. The
// container is removed when the restore ends, whatever happened.
export class PackageRestore {
  constructor(
    private readonly docker: Docker,
    private readonly config: SandboxConfig,
  ) {}

  /** `hosts`: the vault's package hosts, the only ones the restore's pass opens at the proxy. */
  async restore(sandbox: SandboxInfo, what: { repo: string; target: string }, tar: Readable, credentials: FeedCredential[], hosts: string[]): Promise<Outcome<RestoreResult>> {
    const { repo, target } = what;

    if (!this.config.egressNetwork) {
      return { ok: false, reason: "Package restore is off on this host (SANDBOX_EGRESS_NETWORK is not set)" };
    }

    if (!REPO_NAME.test(repo)) {
      return { ok: false, reason: `"${repo}" is not a repo folder name` };
    }

    const repoRoot = posix.join(RESTORE_WORK, repo);
    const where = restoreTarget(repoRoot, target);

    if (!where.ok) {
      return where;
    }

    const container = await this.docker.createContainer(restoreContainerOptions(this.config, sandbox.image, this.proxyUrlFor(hosts), sandbox.id, sandbox.owner, new Date(sandbox.expiresAt)));

    try {
      await container.start();

      return await this.restoreIn(new ContainerExec(this.docker, container.id), repoRoot, where.value, tar, credentials);
    } finally {
      await container.remove({ force: true, v: true });
    }
  }

  // With a signing secret, the proxy URL carries the restore's pass (its vault's hosts, valid for one restore's time).
  private proxyUrlFor(hosts: string[]): string {
    if (!this.config.proxySecret) {
      return this.config.proxyUrl;
    }

    const url = new URL(this.config.proxyUrl);

    url.username = "restore";
    url.password = proxyTokenOf(this.config.proxySecret, hosts, new Date(Date.now() + this.config.restoreTimeoutMs + PASS_MARGIN_MS));

    return url.toString().replace(/\/$/, "");
  }

  private async restoreIn(exec: ContainerExec, repoRoot: string, where: { folder: string; file: string | null }, tar: Readable, credentials: FeedCredential[]): Promise<Outcome<RestoreResult>> {
    const extracted = await exec.run(["sh", "-c", EXTRACT_SCRIPT, "sh", repoRoot], { stdin: tar, deadlineMs: SETUP_DEADLINE_MS });

    if (extracted.exitCode !== 0) {
      throw new Error(`Copying the repo into the restore container failed: ${extracted.stderr.trim()}`);
    }

    const probe = await probeRepo(exec, repoRoot, where.folder, where.file);

    if (!probe.ok) {
      return probe;
    }

    const plan = restorePlanOf(probe.value);
    const nugetEnv = await this.signIn(exec, probe.value, plan.steps, credentials);
    const steps: RestoreStepResult[] = [];

    for (const step of plan.steps) {
      steps.push(await this.runStep(exec, step, step.ecosystem === "dotnet" ? nugetEnv : []));
    }

    const skipped = plan.steps.length === 0 ? [...plan.skipped, "Nothing to restore: no solution, project, lock file or deno.json here"] : plan.skipped;

    return { ok: true, value: { ok: steps.every((step) => step.exitCode === 0), steps, skipped, packagesPath: PACKAGES } };
  }

  // NuGet's sign-ins go to its restore steps as variables; npm's into this container's own home (a tmpfs).
  private async signIn(exec: ContainerExec, probe: RepoProbe, steps: RestoreStep[], credentials: FeedCredential[]): Promise<string[]> {
    const npmrc = npmrcAuth(probe.npmrc, credentials);

    if (npmrc !== null) {
      await exec.run(["sh", "-c", NPMRC_SCRIPT], { stdin: Buffer.from(npmrc, "utf8"), deadlineMs: SOURCES_DEADLINE_MS });
    }

    if (!steps.some((step) => step.ecosystem === "dotnet") || credentials.length === 0) {
      return [];
    }

    const listing = await exec.run(["dotnet", "nuget", "list", "source", "--format", "Detailed"], { cwd: probe.folder, deadlineMs: SOURCES_DEADLINE_MS });

    return nugetCredentialEnv(nugetSourcesOf(listing.stdout.toString("utf8")), credentials);
  }

  private async runStep(exec: ContainerExec, step: RestoreStep, env: string[]): Promise<RestoreStepResult> {
    const seconds = Math.ceil(this.config.restoreTimeoutMs / 1000);
    const started = Date.now();
    const result = await exec.run(["timeout", "--kill-after=10s", `${seconds}s`, ...step.argv], { cwd: step.cwd, env, deadlineMs: this.config.restoreTimeoutMs + 30_000 });
    const output = cutOutput(result.stdout.toString("utf8") + result.stderr, STEP_OUTPUT_CHARS, "");

    console.log(`restore step "${step.label}" ended with ${result.exitCode}`);

    return { label: step.label, exitCode: result.exitCode, durationMs: Date.now() - started, output: output.text };
  }
}
