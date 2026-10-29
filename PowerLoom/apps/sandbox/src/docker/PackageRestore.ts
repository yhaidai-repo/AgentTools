import { posix } from "node:path";
import type { Readable } from "node:stream";
import type Docker from "dockerode";
import { PACKAGES, type FeedCredential, type RestoreProgress, type RestoreResult, type RestoreStepResult } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { PreparedRestore } from "../models/PreparedRestore";
import type { RepoProbe } from "../models/RepoProbe";
import type { RestoreOptions } from "../models/RestoreOptions";
import type { RestoreStep } from "../models/RestoreStep";
import type { SandboxConfig } from "../models/SandboxConfig";
import type { SandboxInfo } from "@powerloom/sandbox";
import { npmrcAuth, nugetCredentialEnv, nugetSourcesOf } from "../restore/feedCredentials";
import { additionSteps } from "../restore/packageAdditions";
import { probeRepo, restoreTarget } from "../restore/probeRepo";
import { restorePlanOf } from "../restore/restorePlan";
import { cutOutput } from "../sessions/cutOutput";
import { RestoreBudget } from "../restore/RestoreBudget";
import { packageCacheSize } from "../restore/packageCacheSize";
import { RestoreTracker } from "../restore/RestoreTracker";
import { ContainerExec } from "./ContainerExec";
import { deadlineAfter, underTimeout } from "./execDeadlines";
import { proxyTokenOf } from "../proxy/proxyToken";
import type { RestoreQueue } from "./RestoreQueue";
import { RESTORE_WORK, restoreContainerOptions } from "./sandboxContainerOptions";

const REPO_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const STEP_OUTPUT_CHARS = 8_000;
const SETUP_DEADLINE_MS = 10 * 60_000;
const SOURCES_DEADLINE_MS = 60_000;
const EXTRACT_SCRIPT = `mkdir -p -- "$1" && tar -x -C "$1"`;
const NPMRC_SCRIPT = `cat > "$HOME/.npmrc"`;
// A pass outlives its restore's time limit by this much, so a slow last step isn't cut off at the proxy.
const PASS_MARGIN_MS = 5 * 60_000;
// What `timeout` exits with on its signal, reported for a step there was no time left to run.
const TIMED_OUT_CODE = 124;

// A restore (design agent-sandbox, phase 3): in a container of its own, on the unchanged copy of a repo (the tar the
// runner sends, never the agent's edited workspace), with the network through the egress proxy and the feeds'
// sign-ins only there. Its packages land in the sandbox's packages volume (the vault's cache), which the agent's
// container reads; restores of one volume take turns. The container is removed when the restore ends, whatever happened.
export class PackageRestore {
  // The restores still running, by repo, for their progress.
  private readonly running = new Map<string, RestoreTracker>();

  constructor(
    private readonly docker: Docker,
    private readonly config: SandboxConfig,
    private readonly queue: RestoreQueue,
    private readonly volume: string,
  ) {}

  /** `options.hosts`: the vault's package hosts, the only ones the restore's pass opens at the proxy. */
  async restore(sandbox: SandboxInfo, what: { repo: string; target: string }, tar: Readable, options: RestoreOptions): Promise<Outcome<RestoreResult>> {
    const tracker = new RestoreTracker(new RestoreBudget(this.config.restoreTimeoutMs));
    const prepared = this.prepare(what, options);

    if (!prepared.ok) {
      return prepared;
    }

    this.running.set(what.repo, tracker);

    try {
      return await this.queue.run(this.volume, () => this.restoreInTurn(sandbox, prepared.value, tar, options, tracker));
    } finally {
      this.forgetIfCurrent(what.repo, tracker);
    }
  }

  /** What the running restore of `repo` does now; null when none runs. */
  async progress(repo: string): Promise<Outcome<RestoreProgress | null>> {
    const tracker = this.running.get(repo);

    return { ok: true, value: tracker ? await tracker.progress() : null };
  }

  private forgetIfCurrent(repo: string, tracker: RestoreTracker): void {
    if (this.running.get(repo) === tracker) {
      this.running.delete(repo);
    }
  }

  private restoreInTurn(sandbox: SandboxInfo, prepared: PreparedRestore, tar: Readable, options: RestoreOptions, tracker: RestoreTracker): Promise<Outcome<RestoreResult>> {
    if (tracker.budget.isUsedUp()) {
      return Promise.resolve({ ok: false, reason: `The restore waited its whole time (${this.config.restoreTimeoutMs} ms) for the restores of the same package cache before it; call it again` });
    }

    return this.restoreInContainer(sandbox, prepared, tar, options, tracker);
  }

  private prepare(what: { repo: string; target: string }, options: RestoreOptions): Outcome<PreparedRestore> {
    if (!this.config.egressNetwork) {
      return { ok: false, reason: "Package restore is off on this host (SANDBOX_EGRESS_NETWORK is not set)" };
    }

    if (!REPO_NAME.test(what.repo)) {
      return { ok: false, reason: `"${what.repo}" is not a repo folder name` };
    }

    const repoRoot = posix.join(RESTORE_WORK, what.repo);
    const where = restoreTarget(repoRoot, what.target);
    const additions = additionSteps(repoRoot, options.additions);

    if (!where.ok) {
      return where;
    }

    return additions.ok ? { ok: true, value: { repoRoot, where: where.value, additions: additions.value } } : additions;
  }

  private async restoreInContainer(sandbox: SandboxInfo, prepared: PreparedRestore, tar: Readable, options: RestoreOptions, tracker: RestoreTracker): Promise<Outcome<RestoreResult>> {
    const container = await this.docker.createContainer(restoreContainerOptions(this.config, sandbox.image, this.proxyUrlFor(options.hosts), this.volume, sandbox.id, sandbox.owner, new Date(sandbox.expiresAt)));

    try {
      await container.start();

      const exec = new ContainerExec(this.docker, container.id);

      tracker.copying(() => packageCacheSize(exec));

      return await this.restoreIn(exec, prepared, tar, options.credentials, tracker);
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

  private async restoreIn(exec: ContainerExec, prepared: PreparedRestore, tar: Readable, credentials: FeedCredential[], tracker: RestoreTracker): Promise<Outcome<RestoreResult>> {
    const { repoRoot, where } = prepared;
    const extracted = await exec.run(["sh", "-c", EXTRACT_SCRIPT, "sh", repoRoot], { stdin: tar, deadlineMs: tracker.budget.deadlineWithin(SETUP_DEADLINE_MS) });

    if (extracted.exitCode !== 0) {
      throw new Error(`Copying the repo into the restore container failed: ${extracted.stderr.trim()}`);
    }

    const probe = await probeRepo(exec, repoRoot, where.folder, where.file);

    if (!probe.ok) {
      return probe;
    }

    const plan = restorePlanOf(probe.value);
    const planned = [...prepared.additions, ...plan.steps];
    const nugetEnv = await this.signIn(exec, probe.value, planned, credentials);
    const steps: RestoreStepResult[] = [];

    await tracker.planned(planned.length);

    for (const step of planned) {
      steps.push(await this.runTrackedStep(exec, step, step.ecosystem === "dotnet" ? nugetEnv : [], tracker));
    }

    const skipped = planned.length === 0 ? [...plan.skipped, "Nothing to restore: no solution, project, lock file or deno.json here"] : plan.skipped;

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

  private async runTrackedStep(exec: ContainerExec, step: RestoreStep, env: string[], tracker: RestoreTracker): Promise<RestoreStepResult> {
    tracker.stepStarted(step.label);

    const result = await this.runStep(exec, step, env, tracker);

    tracker.stepEnded(result);

    return result;
  }

  private async runStep(exec: ContainerExec, step: RestoreStep, env: string[], tracker: RestoreTracker): Promise<RestoreStepResult> {
    const { budget } = tracker;

    if (budget.isUsedUp()) {
      return { label: step.label, exitCode: TIMED_OUT_CODE, durationMs: 0, output: `Not run: the steps before it used up the restore's time (${this.config.restoreTimeoutMs} ms)` };
    }

    const limitMs = budget.remainingMs();
    const started = Date.now();
    const result = await exec.run(underTimeout(step.argv, limitMs), { cwd: step.cwd, env, deadlineMs: deadlineAfter(limitMs), onStdout: (chunk) => tracker.printed(chunk) });
    const output = cutOutput(result.stdout.toString("utf8") + result.stderr, STEP_OUTPUT_CHARS, "");

    console.log(`restore step "${step.label}" ended with ${result.exitCode}`);

    return { label: step.label, exitCode: result.exitCode, durationMs: Date.now() - started, output: output.text };
  }
}
