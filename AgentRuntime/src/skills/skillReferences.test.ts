import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadSkills } from "./loadSkills";
import { createSkillTools } from "./skillTools";

test("loads linked skill guidelines and template through use_skill, without vault path guessing", async t => {
  const root = await mkdtemp(join(tmpdir(), "skill-references-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "demo"));
  await writeFile(join(root, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo\n---\nRead [guideline](guideline.md#steps) and [template](./page-template.md).");
  await writeFile(join(root, "demo", "guideline.md"), "Use exact UI labels.");
  await writeFile(join(root, "demo", "page-template.md"), "## Overview");
  const skills = await loadSkills([root], ["demo"]);
  const tool = createSkillTools(skills)[0];
  assert.match((await tool.handler({ name: "demo" })).text, /Supporting files: guideline.md, page-template.md/);
  assert.equal((await tool.handler({ name: "demo", file: "guideline.md" })).text, "Use exact UI labels.");
  assert.equal((await tool.handler({ name: "demo", file: "page-template.md" })).text, "## Overview");
});

test("refuses traversal, unlinked files, missing files, external links and escaping symlinks", async t => {
  const root = await mkdtemp(join(tmpdir(), "skill-reference-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "demo"));
  await writeFile(join(root, "outside.md"), "DO-NOT-READ");
  await writeFile(join(root, "demo", "unlinked.md"), "DO-NOT-READ");
  await writeFile(join(root, "demo", "SKILL.md"), "[outside](../outside.md) [external](https://example.test/a.md) [escape](escape.md) [missing](missing.md) [large](large.md)");
  await writeFile(join(root, "demo", "large.md"), "x".repeat(129 * 1024));
  await symlink(join(root, "outside.md"), join(root, "demo", "escape.md"));
  const skills = await loadSkills([root], ["demo"]);
  const tool = createSkillTools(skills)[0];
  assert.deepEqual(skills[0].supportingFiles, {});
  assert.match((await tool.handler({ name: "demo" })).text, /Unavailable supporting files/);
  for (const file of ["../outside.md", "escape.md", "missing.md", "unlinked.md", "large.md", "/etc/passwd", "constructor"]) {
    const result = await tool.handler({ name: "demo", file });
    assert.equal(result.isError, true);
    assert.equal(result.text.includes("DO-NOT-READ"), false);
  }
});

test("retains first-folder priority and supports legacy in-memory skill definitions", async t => {
  const root = await mkdtemp(join(tmpdir(), "skill-reference-priority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ["first", "second"]) {
    await mkdir(join(root, folder, "demo"), { recursive: true });
    await writeFile(join(root, folder, "demo", "SKILL.md"), "[guide](guide.md)");
    await writeFile(join(root, folder, "demo", "guide.md"), folder);
  }
  const tool = createSkillTools(await loadSkills([join(root, "first"), join(root, "second")], ["demo"]))[0];
  assert.equal((await tool.handler({ name: "demo", file: "guide.md" })).text, "first");
  const legacy = createSkillTools([{ name: "legacy", description: "Example", body: "Original" }])[0];
  assert.equal((await legacy.handler({ name: "legacy" })).text, "Original");
});
