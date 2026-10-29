import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePrompt, loadAgentPrompt, loadPrompt } from "./prompts";

const FRAMEWORK = "<!-- prompt: framework · version: v2 -->\n## How you work\nVerify first.\n";

async function readFramework(name: string): Promise<string> {
  assert.equal(name, "_framework");

  return FRAMEWORK;
}

describe("composePrompt", () => {
  it("inserts the framework and records both versions", async () => {
    const raw = "<!-- prompt: better-research · version: v1 -->\n{{framework}}\n\nYou are research of {{team}}.";

    const prompt = await composePrompt(raw, { team: "Catalog" }, readFramework);

    assert.equal(prompt.text, "## How you work\nVerify first.\n\nYou are research of Catalog.");
    assert.equal(prompt.version, "v1+framework.v2");
  });

  it("leaves a prompt without the placeholder as it was", async () => {
    const raw = "<!-- prompt: research · version: v10 -->\nYou are research of {{team}}.";
    const unread = async (): Promise<string> => assert.fail("the framework must not be read");

    const prompt = await composePrompt(raw, { team: "Catalog" }, unread);

    assert.deepEqual(prompt, { text: "You are research of Catalog.", version: "v10" });
  });
});

describe("loadPrompt", () => {
  it("keeps today's prompts unchanged", async () => {
    const prompt = await loadPrompt("tech-writer", { team: "Catalog" });

    assert.equal(prompt.version, "v13");
    assert.doesNotMatch(prompt.text, /How you work/);
  });

  it("gives the planning prompt the framework, GSD's steps and the gated review hand-off", async () => {
    const prompt = await loadPrompt("planning", { team: "Catalog" });

    assert.match(prompt.version, /^v2\+framework\./);
    assert.match(prompt.text, /How you work/);
    assert.match(prompt.text, /gsd-discuss-phase` with `<phase> --auto`/);
    assert.match(prompt.text, /`intent: "review"`, `gate: "approve"`/);
    assert.match(prompt.text, /`depends_on: \["new:1"\]`/);
    assert.doesNotMatch(prompt.text, /write_design/);
  });

  it("gives the implementation prompt the outcome first, GSD's execution, the sandbox builds and the hand-over without a push", async () => {
    const prompt = await loadPrompt("implementation", { team: "Catalog" });

    assert.match(prompt.version, /^v3\+framework\./);
    assert.match(prompt.text, /call `sandbox_open` and `sandbox_restore` once/);
    assert.match(prompt.text, /Never hand over unbuilt code .* a restore or build failure the code can't fix is a blocker/);
    assert.match(prompt.text, /\("unreachable"\) is retried in this run, not assumed/);
    assert.match(prompt.text, /a new NuGet package goes through `sandbox_restore` with `packages`, then a PackageReference in the worktree/);
    assert.doesNotMatch(prompt.text, /don't run in the worktree's shell/);
    assert.match(prompt.text, /How you work/);
    assert.match(prompt.text, /`outcome="replan"`: build nothing\. `hand_off` to `design` with `intent: "continue"`/);
    assert.match(prompt.text, /Skill `gsd-execute-phase` with `<phase>`/);
    assert.match(prompt.text, /answer `skip: needs a person: <why>`/);
    assert.match(prompt.text, /`intent: "review"`, `gate: "none"`/);
    assert.match(prompt.text, /Never `git push`, never open a pull request, never run GSD's ship step/);
  });

  it("gives the autotest prompt the continue and hand-off rules", async () => {
    const prompt = await loadPrompt("autotest", { team: "Catalog" });

    assert.match(prompt.version, /^v14\+framework\./);
    assert.match(prompt.text, /Each bug in `<bugs-to-retest>` is a case too/);
    assert.match(prompt.text, /Before delegating missing test data to Refinement, use the granted database tools to search/);
    assert.match(prompt.text, /## Continuing from a previous report/);
    assert.match(prompt.text, /An API criterion is proven with `http_request` alone/);
    assert.match(prompt.text, /a cancelled one is the user's decision not to do it/);
    assert.match(prompt.text, /The branch the task names is started as named/);
    assert.match(prompt.text, /An action that may have changed state or cost money \(a submit, a save, a call to a paid or external service\) is never simply repeated/);
    assert.match(prompt.text, /a new commit on the same branch is a change/);
    assert.match(prompt.text, /A background host runs \*\*no\*\* worker unless `start_stack`'s `config` names it/);
  });
});

describe("loadAgentPrompt", () => {
  it("runs a stored prompt under its version, with the framework filled in", async () => {
    const prompt = await loadAgentPrompt("security-review", { text: ["{{framework}}", "", "Review {{team}} for secrets."].join("\n"), version: 3 }, { team: "Catalog" });

    assert.match(prompt.version, /^ui-v3\+framework\./);
    assert.match(prompt.text, /How you work/);
    assert.match(prompt.text, /Review Catalog for secrets\./);
  });

  it("falls back to the agent's prompt file while the stored prompt is empty", async () => {
    const prompt = await loadAgentPrompt("tech-writer", { text: "  ", version: 0 }, { team: "Catalog" });

    assert.equal(prompt.version, "v13");
  });

  it("pulls in the framework stored in Settings instead of the file", async () => {
    const prompt = await loadAgentPrompt("autotest", { text: "", version: 0 }, { team: "Catalog" }, { text: "## How you work\nOur own way.", version: 2 });

    assert.match(prompt.version, /^v\d+\+framework\.ui-v2$/);
    assert.match(prompt.text, /^## How you work\nOur own way\./);
  });

  it("keeps the file's framework while none is stored", async () => {
    const prompt = await loadAgentPrompt("autotest", { text: "", version: 0 }, { team: "Catalog" }, { text: " ", version: 0 });

    assert.match(prompt.version, /\+framework\.v\d+$/);
  });

  it("gives an agent with neither the framework alone", async () => {
    const prompt = await loadAgentPrompt("made-in-the-ui", { text: "", version: 0 }, { team: "Catalog" });

    assert.match(prompt.version, /^none\+framework\./);
    assert.match(prompt.text, /How you work/);
  });
});
