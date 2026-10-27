import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_DESCRIPTION_MAX } from "@powerloom/core";
import { AGENT_DEFAULTS } from "./agentDefaults";

describe("the shipped agents", () => {
  // The Config page sends every field on Save: a shipped description agent.update refuses would fail every save.
  it("have descriptions agent.update takes", () => {
    assert.deepEqual(AGENT_DEFAULTS.filter((agent) => agent.description.length > AGENT_DESCRIPTION_MAX).map((agent) => agent.id), []);
  });
});
