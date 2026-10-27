import assert from "node:assert/strict";
import { it } from "node:test";
import type { RepoRef } from "@agenttools/runtime";
import { reviewRepo } from "./ReviewWriter";
import { repoFolderName } from "../repos/agentRepos";

const ref = (name: string): RepoRef => ({ name, remoteUrl: "https://example.invalid/synthetic", defaultBranch: "main" });

it("selects the requested normalized catalog repo independent of attached repo order", () => {
  const unrelated = ref("Unrelated"), wanted = ref(repoFolderName("Target App"));
  for (const repos of [[unrelated, wanted], [wanted, unrelated]]) {
    assert.equal(reviewRepo({ isOn: true, repos, tools: [], commits: {} }, "target app"), wanted);
  }
});

it("refuses missing, disabled or ambiguous targets instead of selecting another repo", () => {
  for (const access of [
    { isOn: false, repos: [ref("Target")] },
    { isOn: true, repos: [ref("Unrelated")] },
    { isOn: true, repos: [] },
    { isOn: true, repos: [ref("Target"), ref("target")] },
  ]) assert.throws(() => reviewRepo({ ...access, tools: [], commits: {} }, "Target"));
});
