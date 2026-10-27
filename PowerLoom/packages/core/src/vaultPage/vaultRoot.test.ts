import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { listTrash, readUsageEvents } from "@powerloom/vault";
import type { PowerLoomDb } from "@powerloom/db";
import { getVaultRegistersCommand } from "../commands/getVaultRegistersCommand";
import { vaultInput } from "../commands/inputs";
import type { CommandContext } from "../models/CommandContext";
import { mountedVaultRoot, vaultRootOf } from "./vaultRoot";
import { readVaultRegisters } from "./vaultRegisters";
import { listVaultNotes } from "./vaultNotes";

function dbWithVault(active: boolean): PowerLoomDb {
  return { select: () => ({ from: () => ({ where: async () => active ? [{ name: "inside", removedAt: null }] : [] }) }) } as unknown as PowerLoomDb;
}

it("S3-01 refuses traversal, inactive vaults and junction escapes before reading registers", async () => {
  const parent = await mkdtemp(join(tmpdir(), "vault-boundary-"));
  const root = join(parent, "vaults");
  await mkdir(join(root, "inside"), { recursive: true });
  await mkdir(join(parent, "outside"));
  await writeFile(join(parent, "outside", "www-log.md"), "## WWW-001 outside sentinel\n");
  await symlink(join(parent, "outside"), join(root, "escape"), "junction");
  await symlink(join(parent, "outside"), join(root, "inside", "linked"), "junction");
  const prior = process.env.VAULTS_DIR;
  process.env.VAULTS_DIR = root;
  try {
    for (const name of ["../outside", "..\\outside", "D:/outside", ".", "..", "inside/../outside"]) {
      assert.equal(vaultInput.safeParse(name).success, false, name);
      assert.equal(vaultRootOf(name), null);
      assert.equal((await getVaultRegistersCommand.run({ db: dbWithVault(true) } as CommandContext, { vault: name, kind: "all", openOnly: false })).ok, false);
    }
    assert.equal((await mountedVaultRoot("inside", dbWithVault(false))).ok, false);
    assert.equal((await mountedVaultRoot("inside", dbWithVault(true))).ok, true);
    assert.equal((await mountedVaultRoot("escape", dbWithVault(true))).ok, false);
    assert.deepEqual((await readVaultRegisters(join(root, "inside"))).www, []);
  } finally {
    if (prior === undefined) delete process.env.VAULTS_DIR;
    else process.env.VAULTS_DIR = prior;
  }
});

it("S3-01 refuses linked usage and trash folders at their canonical targets", async () => {
  const parent = await mkdtemp(join(tmpdir(), "vault-links-"));
  const vault = join(parent, "vault");
  const outside = join(parent, "outside");
  await mkdir(vault);
  await mkdir(outside);
  await writeFile(join(outside, "usage.jsonl"), JSON.stringify({ ts: "2026-10-26", file: "outside.md", kind: "read", agent: "synthetic" }));
  await writeFile(join(outside, "outside.md"), "# Outside sentinel\n");
  await symlink(outside, join(vault, ".usage"), "junction");
  await symlink(outside, join(vault, ".trash"), "junction");
  assert.deepEqual(await readUsageEvents(vault), []);
  assert.deepEqual(await listTrash(vault), []);
  assert.deepEqual(await listVaultNotes(vault), []);
});

it("S3-01 refuses a linked register file while ordinary register files remain readable", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "vault-register-link-"));
  const vault = join(parent, "vault");
  await mkdir(vault);
  const outside = join(parent, "www-log.md");
  await writeFile(outside, "# What went wrong\n\n## WWW-001 Outside sentinel\n\n- **Status:** open\n");
  try {
    await symlink(outside, join(vault, "www-log.md"), "file");
  } catch (error) {
    if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("File symlinks require Windows privileges; directory junction guards are tested separately.");
      return;
    }
    throw error;
  }
  assert.deepEqual((await readVaultRegisters(vault)).www, []);
});
