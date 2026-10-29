import type { CommandContext } from "@powerloom/core";
import type { LiveTestRule } from "./models/LiveTestRule";
import { deleteQueuedRefinement } from "./queuedRefinement";
import { takenTypeProblem, takenTypeProblemOfItem } from "./taskTypeRefusals";
import { agentEntity, agentTarget, itemTarget, pbiEntity, pbiReferenceTarget, pbiTarget, scheduleEntity, scheduleTarget, taskEntity } from "./liveTestTargets";

// The write commands a live test may call, each with what it creates, what it changes and what it refuses. A test
// changes only what its run created; everything it creates is removed when the run ends.

const STARTS_WORK = "a live test doesn't start real work";

// An enabled agent taking a task's type picks the task up within minutes (it dispatches every 2), which starts a run and
// spends budget: the test makes and reopens only tasks of a type no enabled agent takes, and deletes them after checking.
const TASK_TYPE_NOTE = "Only for a task type no enabled agent takes (a disabled agent you create with agent_create can handle a type of its own); delete the task with item_delete after checking it.";

function pbiOnly(command: string): LiveTestRule {
  return { command, targets: (input) => pbiTarget(input.adoId) };
}

function itemOfPbi(command: string): LiveTestRule {
  return { command, targets: (input) => [...itemTarget(input.itemId), ...pbiTarget(input.adoId)] };
}

export const LIVE_TEST_RULES: LiveTestRule[] = [
  {
    command: "pbi.create",
    targets: (input) => pbiTarget(input.parentId),
    created: (output, input) => pbiEntity(output.adoId, input.parentId),
  },
  {
    command: "bug.report",
    targets: (input) => pbiReferenceTarget(input.parent),
    created: (output) => pbiEntity(output.adoId, output.parentId),
    settle: (context, _input, output) => deleteQueuedRefinement(context, [output.adoId]),
    note: "The refinement task PowerLoom queues for the new bug is deleted here at once, so no refinement agent starts on it.",
  },
  {
    command: "task.create",
    targets: (input) => pbiReferenceTarget(input.pbi),
    refusal: (input, context) => taskRefusal(input, context),
    created: (output) => [...taskEntity(output.taskId, output.pbiId), ...scheduleEntity(output.scheduleId)],
    note: TASK_TYPE_NOTE,
  },
  {
    command: "schedule.save",
    targets: (input) => [...scheduleTarget(input.id), ...pbiReferenceTarget(input.pbi)],
    refusal: (input) => (input.enabled ? `${STARTS_WORK}: save the schedule with enabled false (one that is on creates real tasks on its cron).` : null),
    created: (output, input) => (input.id === null ? scheduleEntity(output.id) : []),
  },
  {
    command: "agent.create",
    targets: () => [],
    refusal: (input) => agentRefusal(input),
    created: (output) => agentEntity(output.id),
  },
  { command: "agent.update", targets: (input) => agentTarget(input.id), refusal: (input) => agentRefusal(input) },
  { command: "agent.delete", targets: (input) => agentTarget(input.id), removed: (input) => agentEntity(input.id) },
  { command: "schedule.delete", targets: (input) => scheduleTarget(input.id), removed: (input) => scheduleEntity(input.id) },
  { command: "pbi.delete", targets: (input) => pbiTarget(input.adoId), removed: (input) => pbiEntity(input.adoId) },
  pbiOnly("pbi.close"),
  pbiOnly("pbi.reopen"),
  {
    command: "pbi.finish",
    targets: (input) => pbiTarget(input.adoId),
    refusal: (input) => (input.whatWentWrong === null ? null : "a live test finishes a PBI with whatWentWrong null: what went wrong is written into the vault's WWW log."),
  },
  pbiOnly("pbi.saveRepos"),
  pbiOnly("pbi.saveSkills"),
  pbiOnly("pbi.userNotes.save"),
  {
    command: "pbi.attach",
    targets: (input) => [...pbiTarget(input.adoId), ...itemTarget(input.itemId)],
    note: "A live test has no PC paths: attach a file that exists under the vaults root as this run mounts it, e.g. <vaults root>/<vault>/index.md (the vault's docs tools list its notes). A PBI's own note (pbi_get's notePath) is in PowerLoom's backlog, not under the vaults root, so it can't be attached.",
  },
  pbiOnly("pbi.confluenceLink.add"),
  pbiOnly("pbi.confluenceLink.remove"),
  pbiOnly("pbi.confluenceLoad"),
  itemOfPbi("item.close"),
  { ...itemOfPbi("item.delete"), removed: (input) => taskEntity(input.itemId, input.adoId) },
  { ...itemOfPbi("task.rerun"), refusal: (input, context) => takenTypeProblemOfItem(context, input.itemId), note: TASK_TYPE_NOTE },
  { command: "task.notes.save", targets: (input) => itemTarget(input.itemId) },
  { command: "task.stop", targets: (input) => itemTarget(input.itemId) },
  itemOfPbi("task.edit"),
];

// The changing commands a live test never gets: they start agent runs that cost budget (pbi.prepare queues a
// refinement task that any refinement agent can take before it is deleted; schedule.tick, agent.run, review.queue),
// change what every agent shares (agent.pause, agent.saveGlobal, agent.saveFramework, skill.*), or write into real
// vaults, Azure DevOps or the repos with no undo (registers, vault capture and trash, WWW, findings, reviews, PR syncs,
// repos, cleanup, dead letters); chat.open opens a desktop chat; failure.report writes into the list every PowerLoom
// failure goes to, which is no data of a run.
export const LIVE_TEST_EXCLUDED = [
  "pbi.prepare",
  "pbi.sync",
  "pbi.importNow",
  "schedule.tick",
  "agent.run",
  "agent.pause",
  "agent.saveGlobal",
  "agent.saveFramework",
  "skill.create",
  "skill.save",
  "skill.restore",
  "register.add",
  "register.close",
  "vault.capture",
  "vault.add",
  "vault.remove",
  "vault.trashRestore",
  "vault.trashDelete",
  "www.create",
  "finding.submit",
  "review.add",
  "review.addLocal",
  "review.queue",
  "review.close",
  "review.delete",
  "review.answerComment",
  "pullRequests.sync",
  "repo.enable",
  "repo.addLocal",
  "repo.remove",
  "cleanup.run",
  "deadletter.replay",
  "deadletter.discard",
  "chat.open",
  "failure.report",
];

// Only on a PBI the run created (a task without one is any agent's at once), a schedule only while it is off, and a task
// only of a type no enabled agent takes.
function taskRefusal(input: { pbi: string | null; type: string; cron: string | null; enabled: boolean }, context: CommandContext): string | null | Promise<string | null> {
  if (input.pbi === null) {
    return "a live test creates a task only on a PBI it created: give pbi.";
  }

  if (input.cron !== null) {
    return input.enabled ? `${STARTS_WORK}: a schedule (cron) is saved with enabled false.` : null;
  }

  return takenTypeProblem(context, input.type);
}

function agentRefusal(input: { enabled?: boolean; schedule?: string | null }): string | null {
  if (input.enabled === true) {
    return `${STARTS_WORK}: an agent it makes or changes stays disabled.`;
  }

  return input.schedule ? `${STARTS_WORK}: an agent it makes or changes has no schedule.` : null;
}
