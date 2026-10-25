import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentsGlobal } from "@agenttools/config";
import { withFrameworkVersion } from "./frameworkVersioning";
import { readPromptFile } from "./promptFiles";

const GLOBAL: AgentsGlobal = { paused: false, pausedUntil: null, dailyBudgetUsd: 10, framework: "## Ours v2", frameworkVersion: 2 };

describe("withFrameworkVersion", () => {
  it("makes an edit the next version and keeps an unchanged text's", async () => {
    const edited = await withFrameworkVersion("## Ours v3", GLOBAL, { version: 2, text: "## Ours v2" });
    const same = await withFrameworkVersion("## Ours v2\r\n", GLOBAL, { version: 2, text: "## Ours v2" });

    assert.deepEqual([edited.global.frameworkVersion, edited.writesHistory], [3, true]);
    assert.deepEqual([same.global.frameworkVersion, same.writesHistory], [2, false]);
  });

  it("goes on after a save whose settings write failed once its history row was in", async () => {
    // History holds version 3; the settings still say 2.
    const retried = await withFrameworkVersion("## Ours v3", GLOBAL, { version: 3, text: "## Ours v3" });
    const other = await withFrameworkVersion("## Something else", GLOBAL, { version: 3, text: "## Ours v3" });

    assert.deepEqual([retried.global.frameworkVersion, retried.writesHistory], [3, false]);
    assert.deepEqual([other.global.frameworkVersion, other.writesHistory], [4, true]);
  });

  it("puts the agents back on the file for the file's own text", async () => {
    const file = await readPromptFile("_framework");
    const reset = await withFrameworkVersion(file?.text ?? "", GLOBAL, { version: 2, text: "## Ours v2" });

    assert.ok(file);
    assert.deepEqual([reset.global.framework, reset.global.frameworkVersion, reset.writesHistory], ["", 2, false]);
  });
});
