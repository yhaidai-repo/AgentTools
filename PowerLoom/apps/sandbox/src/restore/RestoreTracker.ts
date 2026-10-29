import type { PackageCacheSize, RestoreProgress, RestoreStepNow, RestoreStepResult } from "@powerloom/sandbox";
import type { CacheCount } from "../models/CacheCount";
import { lastOutputLine } from "./lastOutputLine";
import type { RestoreBudget } from "./RestoreBudget";

// Enough of a step's output to hold its last line.
const OUTPUT_TAIL_CHARS = 4_000;

type CacheMeasure = () => Promise<CacheCount | null>;

// One restore's progress while its call is pending, for GET /sandboxes/{id}/restore/{repo}: the restore reports each
// stage and step here, and a reader gets them with the package cache measured at the time it asks.
export class RestoreTracker {
  private stage: RestoreProgress["stage"] = "waiting";
  private readonly startedAt = new Date();
  private stepCount = 0;
  private step: RestoreStepNow | null = null;
  private readonly ended: Omit<RestoreStepResult, "output">[] = [];
  private outputTail = "";
  private measure: CacheMeasure | null = null;
  private baseline: CacheCount | null = null;

  constructor(readonly budget: RestoreBudget) {}

  /** Its container runs and the repo is being copied in; `measure` reads the package cache from that container. */
  copying(measure: CacheMeasure): void {
    this.stage = "copying";
    this.measure = measure;
  }

  /** Its steps are known; the cache is measured once first, so a reader learns what the restore added. */
  async planned(stepCount: number): Promise<void> {
    this.stage = "restoring";
    this.stepCount = stepCount;
    this.baseline = await this.measured();
  }

  stepStarted(label: string): void {
    this.step = { number: this.ended.length + 1, label, startedAt: new Date().toISOString() };
    this.outputTail = "";
  }

  printed(chunk: Buffer): void {
    this.outputTail = (this.outputTail + chunk.toString("utf8")).slice(-OUTPUT_TAIL_CHARS);
  }

  stepEnded(result: RestoreStepResult): void {
    this.ended.push({ label: result.label, exitCode: result.exitCode, durationMs: result.durationMs });
    this.step = null;
  }

  async progress(): Promise<RestoreProgress> {
    return {
      stage: this.stage,
      startedAt: this.startedAt.toISOString(),
      remainingMs: this.budget.remainingMs(),
      stepCount: this.stepCount,
      step: this.step,
      ended: [...this.ended],
      lastLine: this.step ? lastOutputLine(this.outputTail) : null,
      cache: this.stage === "restoring" ? this.cacheSize(await this.measured()) : null,
    };
  }

  private measured(): Promise<CacheCount | null> {
    return this.measure ? this.measure() : Promise.resolve(null);
  }

  private cacheSize(now: CacheCount | null): PackageCacheSize | null {
    if (!now) {
      return null;
    }

    return { ...now, addedPackages: Math.max(0, now.nugetPackages - (this.baseline?.nugetPackages ?? now.nugetPackages)) };
  }
}
