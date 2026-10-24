import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { CodexHome } from "./CodexHome";

describe("PowerLoom's Codex home", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-home-"));

  after(() => rm(root, { recursive: true, force: true }));

  it("is signed in while a saved login file is there, and not after signing out", async () => {
    const home = new CodexHome(join(root, "codex"));

    assert.equal(await home.isSignedIn(), false);
    await home.saveLoginFile('{"tokens":{}}');
    assert.equal(await home.isSignedIn(), true);
    assert.equal(await readFile(home.authFile, "utf8"), '{"tokens":{}}');
    await home.signOut();
    assert.equal(await home.isSignedIn(), false);
  });

  it("refuses a file that isn't a JSON object", async () => {
    const home = new CodexHome(join(root, "refused"));

    await assert.rejects(home.saveLoginFile("not json"), /isn't a Codex login file/);
    await assert.rejects(home.saveLoginFile("[1]"), /isn't a Codex login file/);
    assert.equal(await home.isSignedIn(), false);
  });
});
