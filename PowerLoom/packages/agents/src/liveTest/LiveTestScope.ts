import type { ItemPbiLookup } from "./models/ItemPbiLookup";
import type { LiveTestEntity } from "./models/LiveTestEntity";
import type { LiveTestTarget } from "./models/LiveTestTarget";
import { targetLabel } from "./liveTestTargets";

// Cleanup removes agents and schedules first (they could start work), then tasks, then PBIs, which take their items
// and child PBIs with them.
const CLEANUP_ORDER: LiveTestEntity["kind"][] = ["agent", "schedule", "task", "pbi"];

// What one live-test run created and still holds: the guard lets the run change only these, and cleanup removes what
// is left when the run ends.
export class LiveTestScope {
  private entities: LiveTestEntity[] = [];

  constructor(private readonly itemPbi: ItemPbiLookup) {}

  get isEmpty(): boolean {
    return this.entities.length === 0;
  }

  record(created: LiveTestEntity[]): void {
    this.entities.push(...created.filter((entity) => !this.has(entity.kind, entity.id)));
  }

  /** Drops what was removed, and with a PBI everything that went with it (its tasks, its child PBIs). */
  forget(removed: LiveTestEntity[]): void {
    for (const entity of removed) {
      this.entities = this.entities.filter((held) => !(held.kind === entity.kind && held.id === entity.id));
      this.forget(entity.kind === "pbi" ? this.entities.filter((held) => String(held.pbiId) === entity.id) : []);
    }
  }

  /** Why the run may not change these targets (the first one it didn't create), or null when it owns them all. */
  async notOwnedProblem(targets: LiveTestTarget[]): Promise<string | null> {
    for (const target of targets) {
      if (!(await this.owns(target))) {
        return `${targetLabel(target)} wasn't created by this test run; a live test changes only its own data.`;
      }
    }

    return null;
  }

  /** What cleanup removes, in its order, newest first within a kind (a child PBI before its parent); a task on a PBI the
   *  run holds goes with that PBI. */
  leftovers(): LiveTestEntity[] {
    const newestFirst = [...this.entities].reverse().filter((entity) => !this.goesWithItsPbi(entity));

    return CLEANUP_ORDER.flatMap((kind) => newestFirst.filter((entity) => entity.kind === kind));
  }

  private async owns(target: LiveTestTarget): Promise<boolean> {
    if (target.kind === "item") {
      return this.ownsItem(target.id);
    }

    return this.has(target.kind, target.id);
  }

  // An item is the run's when it is a task the run created, or any item of a PBI the run created.
  private async ownsItem(itemId: string): Promise<boolean> {
    if (this.has("task", itemId)) {
      return true;
    }

    const pbiId = await this.itemPbi(itemId);

    return pbiId !== null && pbiId !== undefined && this.has("pbi", String(pbiId));
  }

  private goesWithItsPbi(entity: LiveTestEntity): boolean {
    return entity.kind === "task" && entity.pbiId !== null && entity.pbiId !== undefined && this.has("pbi", String(entity.pbiId));
  }

  private has(kind: LiveTestEntity["kind"], id: string): boolean {
    return this.entities.some((entity) => entity.kind === kind && entity.id === id);
  }
}
