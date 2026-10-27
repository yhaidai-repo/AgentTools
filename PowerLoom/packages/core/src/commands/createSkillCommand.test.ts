import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { listSkills, skillCatalogOf } from "@agenttools/runtime/skills";
import { loadSkills } from "../../../../../AgentRuntime/src/skills/loadSkills";
import type { CommandContext } from "../models/CommandContext";
import { createSkillCommand } from "./createSkillCommand";
import { runCommand } from "./runCommand";

it("skill creation emits metadata that the actual runtime discovers and loads", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "created-skills-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let writes = 0;
  const context = {
    skills: skillCatalogOf([root], root),
    powerloom: { createSkill: async (name: string, content: string) => {
      writes++;
      await mkdir(join(root, name));
      await writeFile(join(root, name, "SKILL.md"), content);
      return { ok: true, value: name };
    } },
  } as unknown as CommandContext;
  const descriptions = ["Use when: reviewing ordinary code changes", '# A description with "quotes" and \\paths', "true # boolean-looking description", "Use for first line\r\nand a second line"];
  for (const [index, description] of descriptions.entries()) {
    const input = { name: `created-${index}`, description, body: "## Checklist\n- Check ordinary code changes." };
    assert.ok((await runCommand(createSkillCommand, context, input)).ok);
    const expected = description.replace(/[\r\n]+/g, " ");
    assert.equal((await listSkills([root])).skills.find((skill) => skill.name === input.name)?.description, expected);
    assert.equal((await loadSkills([root], [input.name]))[0].description, expected);
    const before = await readFile(join(root, input.name, "SKILL.md"), "utf8");
    assert.ok((await runCommand(createSkillCommand, context, { ...input, reuseIfUnchanged: true })).ok);
    assert.equal(await readFile(join(root, input.name, "SKILL.md"), "utf8"), before);
    assert.equal((await runCommand(createSkillCommand, context, { ...input, description: "Conflicting new description", reuseIfUnchanged: true })).ok, false);
    assert.equal((await runCommand(createSkillCommand, context, input)).ok, false);
  }
  assert.equal(writes, descriptions.length);
  const readOnly = { ...context, skills: skillCatalogOf([root], null) };
  assert.equal((await runCommand(createSkillCommand, readOnly, { name: "created-0", description: descriptions[0], body: "## Checklist\n- Check ordinary code changes.", reuseIfUnchanged: true })).ok, false);
});
