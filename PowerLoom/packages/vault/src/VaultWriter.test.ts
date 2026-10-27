import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { VaultWriter } from "./VaultWriter";

const link = (target: string, path: string) => symlink(target, path, process.platform === "win32" ? "junction" : "dir");

it("refuses outside ancestors for every read/write/removal variant without modifying targets", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "vault-writer-scope-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, "vault"), outside = join(folder, "outside");
  await mkdir(join(root, "project"), { recursive: true });
  await mkdir(outside);
  await writeFile(join(outside, "existing.md"), "synthetic original");
  await link(outside, join(root, "project", "alias"));
  const writer = new VaultWriter(root);
  for (const action of [
    () => writer.readText("project/alias/existing.md"),
    () => writer.write("project/alias/existing.md", () => "changed"),
    () => writer.writeText("project/alias/existing.md", "changed"),
    () => writer.appendText("project/alias/existing.md", "changed"),
    () => writer.writeOnce("project/alias/new/deep.md", Buffer.from("changed")),
    () => writer.readOrCreate("project/alias/new/deep.md", "changed"),
    () => writer.remove("project/alias/existing.md"),
    () => writer.removeFolder("project/alias"),
  ]) await assert.rejects(action());
  assert.equal(await readFile(join(outside, "existing.md"), "utf8"), "synthetic original");
  await assert.rejects(access(join(outside, "new")));
  await link(root, join(root, "project", "root-alias"));
  await assert.rejects(writer.removeFolder("project/root-alias"));
  assert.equal(await readFile(join(outside, "existing.md"), "utf8"), "synthetic original");
});

it("keeps normal writes, internal aliases and link-safe recursive deletion usable", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "vault-writer-normal-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, "vault");
  const writer = new VaultWriter(root);
  assert.equal(await writer.writeText("project/note.md", "original"), true);
  assert.equal(await writer.writeText("project/note.md", "original"), false);
  assert.equal(await writer.writeOnce("project/note.md", Buffer.from("changed")), false);
  assert.equal(await writer.readOrCreate("project/note.md", "changed"), "original");
  await link(join(root, "project"), join(root, "alias"));
  assert.equal(await writer.readText("alias/note.md"), "original");
  await mkdir(join(root, "removable"));
  const outside = join(folder, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "keep.md"), "keep");
  await link(outside, join(root, "removable", "external"));
  await writer.removeFolder("removable");
  assert.equal(await readFile(join(outside, "keep.md"), "utf8"), "keep");
  await writer.remove("alias");
  assert.equal(await writer.readText("project/note.md"), "original");
});

it("append-only publication retains concurrent additions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vault-append-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const writer = new VaultWriter(root);
  await writer.writeText("project/rules.md", "Human note.\n");
  await Promise.all(Array.from({ length: 10 }, (_, i) => writer.appendText("project/rules.md", `Addition ${i}\n`)));
  const text = await writer.readText("project/rules.md");
  assert.ok(text?.startsWith("Human note."));
  for (let i = 0; i < 10; i++) assert.equal(text?.split(`Addition ${i}\n`).length, 2);
});

it("refuses a leaf symlink outside the vault", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "vault-writer-leaf-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, "vault"));
  const target = join(folder, "outside.md");
  await writeFile(target, "original");
  try { await symlink(target, join(folder, "vault", "alias.md"), "file"); }
  catch (error) { if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") { t.skip("Windows file-symlink privilege unavailable"); return; } throw error; }
  const writer = new VaultWriter(join(folder, "vault"));
  await assert.rejects(writer.writeText("alias.md", "changed"));
  await assert.rejects(writer.remove("alias.md"));
  assert.equal(await readFile(target, "utf8"), "original");
});
