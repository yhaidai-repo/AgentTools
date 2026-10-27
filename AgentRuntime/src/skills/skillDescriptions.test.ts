import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { listSkills } from "./listSkills";
import { loadSkills } from "./loadSkills";

it("discovers and loads folded/literal descriptions alongside quoted/plain scalars", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "skill-descriptions-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const cases = [
    ["folded", ">\n  First line\n  second line", "First line second line"],
    ["literal", "|-\n  First line\n  second line", "First line\nsecond line"],
    ["paragraph", ">-\n  First line\n\n  Second paragraph", "First line\nSecond paragraph"],
    ["quoted", '"Text: with an escaped \\"quote\\""', 'Text: with an escaped "quote"'],
    ["single", "'It''s quoted'", "It's quoted"],
    ["plain", "Normal description", "Normal description"],
  ];
  for (const [name, yaml] of cases) {
    await mkdir(join(folder, name));
    await writeFile(join(folder, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${yaml}\n---\nBody`);
  }
  const catalog = await listSkills([folder]);
  const loaded = await loadSkills([folder], cases.map(([name]) => name));
  for (const [name, , expected] of cases) {
    assert.equal(catalog.skills.find((skill) => skill.name === name)?.description, expected);
    assert.equal(loaded.find((skill) => skill.name === name)?.description, expected);
  }
});
