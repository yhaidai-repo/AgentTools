import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { relinkDraft, requireNoDraftLinks } from "./draftLinks";

describe("relinkDraft", () => {
  let root = "";

  before(async () => {
    root = await mkdtemp(join(tmpdir(), "draft-links-"));
    await mkdir(join(root, "adoa"), { recursive: true });
    await mkdir(join(root, "draft"), { recursive: true });
    await writeFile(join(root, "adoa", "adoa-index.md"), "| Chain | [[powerloom-local-app-chain|local chain]] |\n");
    await writeFile(join(root, "draft", "powerloom-local-app-chain.md"), "# draft\n");
    await writeFile(join(root, "index.md"), "Root: [[other-draft]]\n");
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("points notes on disk and the run's own notes at the marked note, keeping labels", async () => {
    const draft = { edits: [{ path: "adoa/chain/powerloom-local-chain.md", content: "---\n---\nSee [[powerloom-local-app-chain]].\n" }], findings: [], home: "adoa/chain/powerloom-local-chain.md" };

    const edits = await relinkDraft(root, "powerloom-local-app-chain", draft);

    assert.deepEqual(edits.map((edit) => edit.path), ["adoa/chain/powerloom-local-chain.md", "adoa/adoa-index.md"]);
    assert.equal(edits[0].content, "---\n---\nSee [[powerloom-local-chain]].\n");
    assert.equal(edits[1].content, "| Chain | [[powerloom-local-chain|local chain]] |\n");
    await requireNoDraftLinks(root, "powerloom-local-app-chain", edits);
  });

  it("uses the only note of the run when none is marked", async () => {
    const draft = { edits: [{ path: "adoa/chain/powerloom-local-chain.md", content: "---\n---\n" }], findings: [], home: null };

    const edits = await relinkDraft(root, "powerloom-local-app-chain", draft);

    assert.equal(edits[1].content, "| Chain | [[powerloom-local-chain|local chain]] |\n");
  });

  it("leaves root files alone, so a link there still stops the run", async () => {
    const draft = { edits: [{ path: "pvs/pvs-note.md", content: "---\n---\n" }], findings: [], home: null };

    const edits = await relinkDraft(root, "other-draft", draft);

    assert.deepEqual(edits, draft.edits);
    await assert.rejects(requireNoDraftLinks(root, "other-draft", edits), /index\.md/);
  });
});
