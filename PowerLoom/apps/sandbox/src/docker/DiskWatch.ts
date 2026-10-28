import { WORKSPACE } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { ContainerExec } from "./ContainerExec";

// Docker Desktop's volumes have no size quota, so the workspace is measured instead: at most once a minute (du on a
// big tree takes seconds), and once over the cap every new command is refused. The cap is soft: one command can pass it.
const MEASURE_EVERY_MS = 60_000;
const MEASURE_DEADLINE_MS = 120_000;

export class DiskWatch {
  private usedMb = 0;
  private measuredAt = 0;

  constructor(
    private readonly exec: ContainerExec,
    private readonly capMb: number,
  ) {}

  async check(): Promise<Outcome<null>> {
    await this.measureWhenDue();

    if (this.usedMb <= this.capMb) {
      return { ok: true, value: null };
    }

    return { ok: false, reason: `The workspace uses ${this.usedMb} MB, over its ${this.capMb} MB cap: delete build output (bin, obj, node_modules) with rm before the next command` };
  }

  private async measureWhenDue(): Promise<void> {
    if (Date.now() - this.measuredAt < MEASURE_EVERY_MS) {
      return;
    }

    const result = await this.exec.run(["du", "-sxm", WORKSPACE], { deadlineMs: MEASURE_DEADLINE_MS });

    this.usedMb = Number.parseInt(result.stdout.toString("utf8"), 10) || this.usedMb;
    this.measuredAt = Date.now();
  }
}
