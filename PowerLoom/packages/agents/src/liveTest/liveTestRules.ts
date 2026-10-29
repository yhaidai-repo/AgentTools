import type { LiveTestRule } from "./models/LiveTestRule";
import { deleteQueuedRefinement } from "./queuedRefinement";
import { agentEntity, agentTarget, itemTarget, pbiEntity, pbiReferenceTarget, pbiTarget, scheduleEntity, scheduleTarget, taskEntity } from "./liveTestTargets";

// The write commands a live test may call, each with what it creates, what it changes and what it refuses. A test
// changes only what its run created; everything it creates is removed when the run ends.

const STARTS_WORK = "a live test doesn't start real work";

// A task the test creates can be picked up by a real agent taking its type within minutes (it dispatches every 2),
// which starts a run and spends budget: the test deletes it right after checking it.
const DELETE_TASK_AT_ONCE = "Delete the task with item_delete right after checking it: an enabled agent taking its type picks it up within minutes and starts a run.";

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
    refusal: (input) => taskRefusal(input),
    created: (output) => [...taskEntity(output.taskId, output.pbiId), ...scheduleEntity(output.scheduleId)],
    note: DELETE_TASK_AT_ONCE,
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
  { ...itemOfPbi("task.rerun"), note: DELETE_TASK_AT_ONCE },
  { command: "task.notes.save", targets: (input) => itemTarget(input.itemId) },
];

// The changing commands a live test never gets: they start agent runs that cost budget (pbi.prepare queues a
// refinement task that any refinement agent can take before it is deleted; schedule.tick, agent.run, review.queue),
// change what every agent shares (agent.pause, agent.saveGlobal, agent.saveFramework, skill.*), or write into real
// vaults, Azure DevOps or the repos with no undo (registers, vault capture and trash, WWW, findings, reviews, PR syncs,
// repos, cleanup, dead letters); chat.open opens a desktop chat.
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
];

// Only on a PBI the run created (a task without one is any agent's at once), and never a schedule that is on.
function taskRefusal(input: { pbi: string | null; cron: string | null; enabled: boolean }): string | null {
  if (input.pbi === null) {
    return "a live test creates a task only on a PBI it created: give pbi.";
  }

  return input.cron !== null && input.enabled ? `${STARTS_WORK}: a schedule (cron) is saved with enabled false.` : null;
}

function agentRefusal(input: { enabled?: boolean; schedule?: string | null }): string | null {
  if (input.enabled === true) {
    return `${STARTS_WORK}: an agent it makes or changes stays disabled.`;
  }

  return input.schedule ? `${STARTS_WORK}: an agent it makes or changes has no schedule.` : null;
}
