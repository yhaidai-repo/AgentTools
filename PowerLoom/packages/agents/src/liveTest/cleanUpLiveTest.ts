import { runCommand, type CommandContext } from "@powerloom/core";
import { commandNamed } from "./liveTestCommands";
import type { LiveTestScope } from "./LiveTestScope";
import type { LiveTestCleanupReport } from "./models/LiveTestCleanupReport";
import type { LiveTestEntity } from "./models/LiveTestEntity";

// Each kind is removed through the command a person would use.
const REMOVALS: Record<LiveTestEntity["kind"], { command: string; input: (entity: LiveTestEntity) => unknown }> = {
  agent: { command: "agent.delete", input: (entity) => ({ id: entity.id }) },
  schedule: { command: "schedule.delete", input: (entity) => ({ id: Number(entity.id) }) },
  task: { command: "item.delete", input: (entity) => ({ adoId: entity.pbiId ?? null, itemId: entity.id }) },
  pbi: { command: "pbi.delete", input: (entity) => ({ adoId: Number(entity.id) }) },
};

/** Removes what the run still holds, one after the other; one failing doesn't stop the rest, and nothing throws. */
export async function cleanUpLiveTest(scope: LiveTestScope, context: CommandContext): Promise<LiveTestCleanupReport> {
  const report: LiveTestCleanupReport = { removed: [], failed: [] };

  for (const entity of scope.leftovers()) {
    await removeOne(entity, scope, context, report);
  }

  return report;
}

async function removeOne(entity: LiveTestEntity, scope: LiveTestScope, context: CommandContext, report: LiveTestCleanupReport): Promise<void> {
  const label = `${entity.kind} ${entity.id}`;
  const removal = REMOVALS[entity.kind];

  try {
    const outcome = await runCommand(commandNamed(removal.command), context, removal.input(entity));

    if (!outcome.ok) {
      report.failed.push(`${label}: ${outcome.error}`);

      return;
    }

    scope.forget([entity]);
    report.removed.push(label);
  } catch (error) {
    report.failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
