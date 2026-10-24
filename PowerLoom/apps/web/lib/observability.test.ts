import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isObservabilityOn, observabilityState } from "./observability";

describe("observability (otel-lgtm, development only)", () => {
  const original = process.env.PROMETHEUS_URL;

  afterEach(() => {
    process.env.PROMETHEUS_URL = original;
  });

  it("is off when .env gives no Prometheus address", () => {
    process.env.PROMETHEUS_URL = " ";

    assert.equal(isObservabilityOn(), false);
    assert.equal(observabilityState(false, false), "off");
  });

  it("is on with an address, and says whether Prometheus answers", () => {
    process.env.PROMETHEUS_URL = "http://otel-lgtm:9090";

    assert.equal(isObservabilityOn(), true);
    assert.equal(observabilityState(true, true), "answers");
    assert.equal(observabilityState(true, false), "no answer");
  });
});
