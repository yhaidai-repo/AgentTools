import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isObservabilityOn, loadObservabilityState, telemetryDashboardUrl } from "./observability";

describe("standalone telemetry diagnostics", () => {
  const originalInternal = process.env.TELEMETRY_INTERNAL_URL;
  const originalPublic = process.env.TELEMETRY_URL;

  afterEach(() => {
    if (originalInternal === undefined) delete process.env.TELEMETRY_INTERNAL_URL;
    else process.env.TELEMETRY_INTERNAL_URL = originalInternal;
    if (originalPublic === undefined) delete process.env.TELEMETRY_URL;
    else process.env.TELEMETRY_URL = originalPublic;
  });

  it("does not contact the viewer when telemetry is disabled", async () => {
    process.env.TELEMETRY_INTERNAL_URL = " ";
    assert.equal(isObservabilityOn(), false);
    assert.equal(await loadObservabilityState(async () => { throw new Error("unexpected network request"); }), "off");
  });

  it("checks the configured viewer and reports its availability", async () => {
    process.env.TELEMETRY_INTERNAL_URL = "http://telemetry:18888/";
    assert.equal(await loadObservabilityState(async (url) => {
      assert.equal(url, "http://telemetry:18888");
      return new Response("ok");
    }), "answers");
    assert.equal(await loadObservabilityState(async () => new Response("down", { status: 503 })), "no answer");
    assert.equal(await loadObservabilityState(async () => { throw new Error("unreachable"); }), "no answer");
  });

  it("links to the browser-visible address rather than the container address", () => {
    process.env.TELEMETRY_URL = " http://127.0.0.1:3200/ ";
    assert.equal(telemetryDashboardUrl(), "http://127.0.0.1:3200");
    process.env.TELEMETRY_URL = "";
    assert.equal(telemetryDashboardUrl(), null);
  });
});
