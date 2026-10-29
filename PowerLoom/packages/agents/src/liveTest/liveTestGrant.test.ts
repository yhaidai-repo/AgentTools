import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_DEFAULTS } from "../agentDefaults";
import { LIVE_TEST_INTEGRATION } from "./liveTestTools";

const grant = AGENT_DEFAULTS.flatMap((agent) => agent.integrationSpecs ?? []).find((integration) => integration.key === LIVE_TEST_INTEGRATION);

describe("the live-test grant", () => {
  it("describes the reads other grants gate, the limits of the cleanup and the commands it leaves out", () => {
    const description = grant?.description ?? "";

    assert.match(description, /sql_query/);
    assert.match(description, /logs_read/);
    assert.match(description, /settings_get/);
    assert.match(description, /generic runner/);
    assert.match(description, /nothing sweeps/);
    assert.match(description, /pbi_prepare/);
  });

  it("is off for every shipped agent", () => {
    assert.deepEqual(AGENT_DEFAULTS.filter((agent) => agent.capabilities.integrations?.[LIVE_TEST_INTEGRATION] === true).map((agent) => agent.id), []);
  });
});
