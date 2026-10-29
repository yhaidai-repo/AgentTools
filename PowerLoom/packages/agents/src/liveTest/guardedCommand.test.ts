import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMANDS, runCommand, type Command } from "@powerloom/core";
import { fakeLiveTestContext } from "./fakeLiveTestContext";
import { liveTestCommands } from "./liveTestCommands";
import { LIVE_TEST_EXCLUDED, LIVE_TEST_RULES } from "./liveTestRules";
import { LiveTestScope } from "./LiveTestScope";

function setUp(itemKind = "test") {
  const calls: string[] = [];
  const scope = new LiveTestScope(async () => undefined);
  const commands = liveTestCommands(scope);
  const call = (name: string, input: unknown) => runCommand(commands.find((command) => command.name === name) as Command<unknown, unknown>, fakeLiveTestContext(calls, true, itemKind), input);

  return { calls, scope, commands, call };
}

describe("the live-test guard", () => {
  it("refuses a PBI the run didn't create, and lets the run change one it created", async () => {
    const { calls, call } = setUp();

    const refused = await call("pbi.userNotes.save", { adoId: 38519, text: "x", loadedText: "" });
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] notes" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const saved = await call("pbi.userNotes.save", { adoId, text: "x", loadedText: "" });

    assert.deepEqual(refused, { ok: false, error: "pbi.userNotes.save refused: PBI-38519 wasn't created by this test run; a live test changes only its own data." });
    assert.equal(saved.ok, true);
    assert.deepEqual(calls, ["createPbi", `savePbiUserNotes ${adoId}`]);
  });

  it("refuses a PBI named PBI-n, which the backend doesn't read, saying what to give instead", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] reference" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = { vault: "personal-projects", type: "selftest-only", title: "[selftest] t", description: "d", acceptanceCriteria: "a" };

    const refused = await call("task.create", { ...task, pbi: `PBI-${adoId}` });
    const bug = await call("bug.report", { parent: `PBI-${adoId}`, title: "[selftest] bug" });

    assert.deepEqual(refused, { ok: false, error: `task.create refused: PBI-${adoId} is no PBI link, #id or id: give the PBI's number (500, #500) or its link.` });
    assert.equal(bug.ok, false);
    assert.deepEqual(calls, ["createPbi"]);
  });

  it("records what a call created and forgets what a call deleted", async () => {
    const { scope, call } = setUp();

    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] delete" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = await call("task.create", { vault: "personal-projects", type: "selftest-only", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: `#${adoId}` });

    const byLink = await call("task.create", { vault: "personal-projects", type: "selftest-only", title: "[selftest] task 2", description: "d", acceptanceCriteria: "a", pbi: `https://dev.azure.com/org/p/_workitems/edit/${adoId}` });

    assert.equal(task.ok, true);
    assert.equal(byLink.ok, true);
    assert.deepEqual(scope.leftovers().map((entity) => entity.kind), ["pbi"]);
    assert.equal((await call("pbi.delete", { adoId })).ok, true);
    assert.equal(scope.isEmpty, true);
  });

  it("refuses every call that would start real work or write a real vault", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] refusals" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const pbi = String(adoId);
    const task = { vault: "personal-projects", type: "selftest-only", title: "[selftest] t", description: "d", acceptanceCriteria: "a" };

    const refused = [
      await call("pbi.finish", { adoId, rating: 5, effortHours: 1, whatWentWrong: "it broke", fault: "Agent" }),
      await call("agent.create", { id: "selftest-probe", label: "Probe", description: "d", prompt: "p", handles: ["test"], enabled: true }),
      await call("agent.create", { id: "selftest-probe", label: "Probe", description: "d", prompt: "p", handles: ["test"], schedule: "0 7 * * 1" }),
      await call("schedule.save", { id: null, vault: "personal-projects", name: "[selftest] s", cron: "0 7 * * 1", type: "selftest-only", description: "d", acceptanceCriteria: "a", pbi }),
      await call("task.create", { ...task, pbi, cron: "0 7 * * 1" }),
      await call("task.create", { ...task, pbi: null }),
    ];

    assert.deepEqual(refused.map((outcome) => outcome.ok), [false, false, false, false, false, false]);
    assert.deepEqual(calls, ["createPbi"]);
  });

  it("stops and edits a task only when the run created it or its PBI", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] stop" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = await call("task.create", { vault: "personal-projects", type: "selftest-only", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: String(adoId) });
    const itemId = task.ok ? (task.value as { taskId: string }).taskId : "";
    const text = { title: "[selftest] new", description: "d", acceptanceCriteria: "a" };

    const stopped = await call("task.stop", { itemId });
    const edited = await call("task.edit", { adoId, itemId, ...text });
    const strangerStopped = await call("task.stop", { itemId: "T-1" });
    const strangerEdited = await call("task.edit", { adoId: 38519, itemId: "T-1", ...text });

    assert.deepEqual([stopped.ok, edited.ok, strangerStopped.ok, strangerEdited.ok], [true, true, false, false]);
    assert.deepEqual(calls, ["createPbi", "createTask", `stopTask ${itemId}`, `editTask ${itemId}`]);
  });

  it("makes a task only of a type no enabled agent takes", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] types" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = { vault: "personal-projects", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: String(adoId) };

    const taken = await call("task.create", { ...task, type: "test" });
    const free = await call("task.create", { ...task, type: "selftest-only" });

    assert.deepEqual(taken, { ok: false, error: "task.create refused: autotest would take a test task and start a run: a live test uses a task type no enabled agent takes (create a disabled agent that handles a type of its own)." });
    assert.equal(free.ok, true);
    assert.deepEqual(calls, ["createPbi", "createTask"]);
  });

  it("reopens a task only when its type is one no enabled agent takes", async () => {
    for (const [itemKind, reopened] of [["selftest-only", true], ["test", false]] as const) {
      const { calls, call } = setUp(itemKind);
      const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] rerun" });
      const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
      const task = await call("task.create", { vault: "personal-projects", type: "selftest-only", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: String(adoId) });
      const itemId = task.ok ? (task.value as { taskId: string }).taskId : "";

      const rerun = await call("task.rerun", { adoId, itemId });

      assert.equal(rerun.ok, reopened, itemKind);
      assert.equal(calls.includes(`rerunTask ${adoId} ${itemId}`), reopened, itemKind);
    }
  });

  it("finishes an owned PBI without a what-went-wrong text, and refuses the text that would write a WWW record", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] finish" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;

    const written = await call("pbi.finish", { adoId, rating: 5, effortHours: 1, whatWentWrong: "it broke", fault: "Agent" });
    const finished = await call("pbi.finish", { adoId, rating: 5, effortHours: 1 });
    const stranger = await call("pbi.finish", { adoId: 38519, rating: 5, effortHours: 1 });

    assert.deepEqual(written, { ok: false, error: "pbi.finish refused: a live test finishes a PBI with whatWentWrong null: what went wrong is written into the vault's WWW log." });
    assert.equal(finished.ok, true);
    assert.equal(stranger.ok, false);
    assert.deepEqual(calls, ["createPbi", `finishPbi ${adoId}`]);
  });

  it("changes an agent only when the run created it, and never enables it or gives it a schedule", async () => {
    const { scope, call } = setUp();

    scope.record([{ kind: "agent", id: "selftest-probe" }]);

    const stranger = await call("agent.update", { id: "better-research", label: "Changed" });
    const enabled = await call("agent.update", { id: "selftest-probe", enabled: true });
    const scheduled = await call("agent.update", { id: "selftest-probe", schedule: "0 7 * * 1" });

    assert.deepEqual(stranger, { ok: false, error: "agent.update refused: agent better-research wasn't created by this test run; a live test changes only its own data." });
    assert.deepEqual(enabled, { ok: false, error: "agent.update refused: a live test doesn't start real work: an agent it makes or changes stays disabled." });
    assert.deepEqual(scheduled, { ok: false, error: "agent.update refused: a live test doesn't start real work: an agent it makes or changes has no schedule." });
  });

  it("runs calls one after the other, so a delete and a create on the same PBI never leave a task of a PBI that is gone", async () => {
    const { scope, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] race" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = { vault: "personal-projects", type: "selftest-only", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: String(adoId) };

    const [deleted, made] = await Promise.all([call("pbi.delete", { adoId }), call("task.create", task)]);

    assert.equal(deleted.ok, true);
    assert.equal(made.ok, false);
    assert.equal(scope.isEmpty, true);
  });

  it("exposes every read command, the allowed writes, and none of the excluded ones", () => {
    const { commands } = setUp();
    const names = new Set(commands.map((command) => command.name));
    const reads = COMMANDS.filter((command) => command.effect === "read").map((command) => command.name);

    assert.deepEqual(reads.filter((name) => !names.has(name)), []);
    assert.deepEqual(LIVE_TEST_EXCLUDED.filter((name) => names.has(name)), []);
    assert.equal(commands.length, reads.length + LIVE_TEST_RULES.length);
  });

  it("classes every changing command: allowed with a rule or excluded, so a new one isn't exposed unguarded", () => {
    const ruled = new Set([...LIVE_TEST_RULES.map((rule) => rule.command), ...LIVE_TEST_EXCLUDED]);
    const changing = COMMANDS.filter((command) => command.effect !== "read").map((command) => command.name);
    const known = new Set(COMMANDS.map((command) => command.name));

    assert.deepEqual(changing.filter((name) => !ruled.has(name)), []);
    assert.deepEqual([...ruled].filter((name) => !known.has(name)), []);
  });

  it("tells the agent in each write's description that it works only on the run's own data", () => {
    const { commands } = setUp();
    const writes = commands.filter((command) => command.effect !== "read" || LIVE_TEST_RULES.some((rule) => rule.command === command.name));

    assert.deepEqual(writes.filter((command) => !command.description.includes("only on data this test run created")).map((command) => command.name), []);
  });

  it("tells the agent to attach a file under the vaults root, not a PBI's note from the backlog", () => {
    const attach = setUp().commands.find((command) => command.name === "pbi.attach");

    assert.match(attach?.description ?? "", /under the vaults root/);
    assert.match(attach?.description ?? "", /notePath\) is in PowerLoom's backlog/);
  });
});
