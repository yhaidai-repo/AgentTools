import assert from "node:assert/strict";
import { mkdtemp, open, writeFile } from "node:fs/promises";
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
