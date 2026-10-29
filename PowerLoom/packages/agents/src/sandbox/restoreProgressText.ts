import type { RestoreProgress, RestoreResult, RestoreStepResult, SandboxAnswer } from "@powerloom/sandbox";

const MINUTE_MS = 60_000;
const MB = 1024 * 1024;
const MAX_END_CHARS = 300;
// What `timeout` exits with when the restore's time ran out.
const TIMED_OUT_CODE = 124;

/** One line on what a running restore does, for the run page, e.g. `step 2/3 dotnet restore App.sln · 3 min · …`. */
export function restoreProgressText(progress: RestoreProgress, now: Date): string {
  const left = `${duration(progress.remainingMs)} left`;

  if (progress.stage === "waiting") {
    return `waiting for an earlier restore of this package cache · ${left}`;
  }

  if (progress.stage === "copying") {
    return `copying the repo in · ${left}`;
  }

  return [stepText(progress, now), cacheText(progress), failedText(progress), left, progress.lastLine].filter(Boolean).join(" · ");
}

/** The last line of a restore: how each step ended, or why the restore didn't run. */
export function restoreEndText(answer: SandboxAnswer<RestoreResult>): string {
  if (!answer.ok) {
    return `ended: ${answer.message}`.slice(0, MAX_END_CHARS);
  }

  if (answer.value.steps.length === 0) {
    return "ended: nothing to restore";
  }

  return `ended: ${answer.value.steps.map(stepEndText).join(" · ")}`;
}

function stepText(progress: RestoreProgress, now: Date): string {
  const { step } = progress;

  if (!step) {
    return `${progress.ended.length}/${progress.stepCount} steps done`;
  }

  return `step ${step.number}/${progress.stepCount} ${step.label} · ${duration(now.getTime() - Date.parse(step.startedAt))}`;
}

function cacheText(progress: RestoreProgress): string | null {
  const { cache } = progress;

  if (!cache) {
    return null;
  }

  const size = `${megabytes(cache.bytes)} cached`;

  return cache.nugetPackages > 0 ? `${cache.nugetPackages} NuGet packages (+${cache.addedPackages}), ${size}` : size;
}

function failedText(progress: RestoreProgress): string | null {
  const failed = progress.ended.filter((step) => step.exitCode !== 0).length;

  return failed > 0 ? `${failed} step${failed === 1 ? "" : "s"} failed` : null;
}

function stepEndText(step: RestoreStepResult): string {
  const took = duration(step.durationMs);

  if (step.exitCode === 0) {
    return `${step.label} ok in ${took}`;
  }

  return step.exitCode === TIMED_OUT_CODE ? `${step.label} timed out after ${took}` : `${step.label} failed (exit ${step.exitCode}) after ${took}`;
}

function duration(ms: number): string {
  return ms < MINUTE_MS ? `${Math.max(0, Math.round(ms / 1000))} s` : `${Math.round(ms / MINUTE_MS)} min`;
}

function megabytes(bytes: number): string {
  return bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`;
}
