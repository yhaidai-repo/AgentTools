import assert from "node:assert/strict";
import { mkdtemp, mkdir, open, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { MAX_ATTACHMENT_BYTES } from "../attachablePath";
import type { CommandContext } from "../models/CommandContext";
import { attachToPbiCommand } from "./attachToPbiCommand";

async function contextOn(mount: string, stored: string[]): Promise<CommandContext> {
  const powerloom = { attachToPbi: async (_adoId: number, files: { fileName: string }[]) => (stored.push(...files.map((file) => file.fileName)), { ok: true, value: ["ATT-1"] }) };

  return { hostFolders: [{ hostRoot: "D:/Projects", mount }], powerloom } as unknown as CommandContext;
}

describe("pbi.attach", () => {
  it("S3-02 follows only links inside the same mount and checks the canonical secret path", async () => {
    const parent = await mkdtemp(join(tmpdir(), "attach-links-"));
    const mount = join(parent, "mount");
    const outside = join(parent, "outside");
    await mkdir(join(mount, "docs"), { recursive: true });
    await mkdir(join(mount, "dev-secrets"));
    await mkdir(outside);
    await writeFile(join(mount, "docs", "spec.md"), "ordinary document");
    await writeFile(join(mount, "dev-secrets", "spec.md"), "synthetic secret sentinel");
    await writeFile(join(outside, "spec.md"), "outside sentinel");
    await symlink(join(mount, "docs"), join(mount, "inside-link"), "junction");
    await symlink(join(mount, "dev-secrets"), join(mount, "secret-alias"), "junction");
    await symlink(outside, join(mount, "outside-link"), "junction");
    const stored: string[] = [];
    const context = await contextOn(mount, stored);
    const attach = (name: string) => attachToPbiCommand.run(context, { adoId: 1, path: `D:/Projects/${name}/spec.md`, itemId: null });
    assert.equal((await attach("inside-link")).ok, true);
    assert.equal((await attach("secret-alias")).ok, false);
    assert.equal((await attach("outside-link")).ok, false);
    assert.deepEqual(stored, ["spec.md"]);
  });

  it("stores a document, and refuses a secret and a file over the limit without reading it", async () => {
    const mount = await mkdtemp(join(tmpdir(), "attach-"));
    const stored: string[] = [];
    const context = await contextOn(mount, stored);
    const big = await open(join(mount, "dump.bak"), "w");

    await writeFile(join(mount, "spec.md"), "# Spec");
    await writeFile(join(mount, ".env"), "TOKEN=x");
    await big.truncate(MAX_ATTACHMENT_BYTES + 1);
    await big.close();

    const attach = (path: string) => attachToPbiCommand.run(context, { adoId: 1, path, itemId: null });
    const [document, secret, tooBig] = [await attach("D:/Projects/spec.md"), await attach("D:/Projects/.env"), await attach("D:/Projects/dump.bak")];

    assert.deepEqual(document, { ok: true, value: { refs: ["ATT-1"] } });
    assert.equal(secret.ok, false);
    assert.equal(tooBig.ok, false);
    assert.match(!tooBig.ok ? tooBig.error : "", /at most 20 MB/);
    assert.deepEqual(stored, ["spec.md"]);
  });
});
