import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { environmentPromptSection, environmentSections } from "./vaultEnvironment";

const NOTE = [
  "# PowerLoom environment",
  "For people: what the agents get.",
  "",
  "## All agents",
  "- SQL: the connection `app-dev`.",
  "",
  "## autotest",
  "- At most 5 paid submits per run.",
  "",
  "## design",
  "- Nothing yet.",
  "",
  "## better-review",
].join("\r\n");

describe("environmentSections", () => {
  it("gives an agent the shared section and its own, nothing else", () => {
    const sections = environmentSections(NOTE, "autotest");

    assert.equal(sections.length, 2);
    assert.match(sections[0], /^## All agents\n- SQL: the connection `app-dev`\.$/);
    assert.match(sections[1], /^## autotest\n- At most 5 paid submits per run\.$/);
  });

  it("leaves out the text before the first section and empty sections", () => {
    assert.deepEqual(environmentSections(NOTE, "better-review").map((section) => section.split("\n")[0]), ["## All agents"]);
    assert.deepEqual(environmentSections("# Only for people", "autotest"), []);
  });
});

describe("environmentPromptSection", () => {
  it("names the vault and is null without ENVIRONMENT.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "vault-"));

    try {
      assert.equal(await environmentPromptSection(root, "team-vault", "autotest"), null);
      await writeFile(join(root, "ENVIRONMENT.md"), NOTE);

      const section = await environmentPromptSection(root, "team-vault", "autotest");

      assert.match(section ?? "", /^# Environment \(the team-vault vault's ENVIRONMENT\.md\)/);
      assert.match(section ?? "", /## Environment: autotest\n- At most 5 paid submits per run\./);
      assert.doesNotMatch(section ?? "", /design/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
