import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMANDS, runCommand, type Command } from "@powerloom/core";
import { fakeLiveTestContext } from "./fakeLiveTestContext";
import { liveTestCommands } from "./liveTestCommands";
import { LIVE_TEST_EXCLUDED, LIVE_TEST_RULES } from "./liveTestRules";
import { LiveTestScope } from "./LiveTestScope";

function setUp() {
  const calls: string[] = [];
  const scope = new LiveTestScope(async () => undefined);
  const commands = liveTestCommands(scope);
  const call = (name: string, input: unknown) => runCommand(commands.find((command) => command.name === name) as Command<unknown, unknown>, fakeLiveTestContext(calls), input);

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

  it("records what a call created and forgets what a call deleted", async () => {
    const { scope, call } = setUp();

    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] delete" });
    const adoId = created.ok ? (created.value as { adoId: number }).adoId : 0;
    const task = await call("task.create", { vault: "personal-projects", type: "test", title: "[selftest] task", description: "d", acceptanceCriteria: "a", pbi: `PBI-${adoId}` });

    const byLink = await call("task.create", { vault: "personal-projects", type: "test", title: "[selftest] task 2", description: "d", acceptanceCriteria: "a", pbi: `https://dev.azure.com/org/p/_workitems/edit/${adoId}` });

    assert.equal(task.ok, true);
    assert.equal(byLink.ok, true);
    assert.deepEqual(scope.leftovers().map((entity) => entity.kind), ["pbi"]);
    assert.equal((await call("pbi.delete", { adoId })).ok, true);
    assert.equal(scope.isEmpty, true);
  });

  it("refuses every call that would start real work or write a real vault", async () => {
    const { calls, call } = setUp();
    const created = await call("pbi.create", { vault: "personal-projects", title: "[selftest] refusals" });
    const pbi = created.ok ? `PBI-${(created.value as { adoId: number }).adoId}` : "";
    const task = { vault: "personal-projects", type: "test", title: "[selftest] t", description: "d", acceptanceCriteria: "a" };

    const refused = [
      await call("pbi.finish", { adoId: Number(pbi.slice(4)), rating: 5, effortHours: 1, whatWentWrong: "it broke", fault: "Agent" }),
      await call("agent.create", { id: "selftest-probe", label: "Probe", description: "d", prompt: "p", handles: ["test"], enabled: true }),
      await call("agent.create", { id: "selftest-probe", label: "Probe", description: "d", prompt: "p", handles: ["test"], schedule: "0 7 * * 1" }),
      await call("schedule.save", { id: null, vault: "personal-projects", name: "[selftest] s", cron: "0 7 * * 1", type: "test", description: "d", acceptanceCriteria: "a", pbi }),
      await call("task.create", { ...task, pbi, cron: "0 7 * * 1" }),
      await call("task.create", { ...task, pbi: null }),
    ];

    assert.deepEqual(refused.map((outcome) => outcome.ok), [false, false, false, false, false, false]);
    assert.deepEqual(calls, ["createPbi"]);
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
});
