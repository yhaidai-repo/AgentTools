import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageSummary } from "./serviceBusMessages";

describe("messageSummary", () => {
  it("keeps the identifying headers and decodes a JSON body sent as bytes", () => {
    const summary = messageSummary({
      sequenceNumber: { toString: () => "42" },
      messageId: "m-1",
      enqueuedTimeUtc: new Date("2026-10-14T10:00:00Z"),
      subject: "SubscriptionCompleted",
      contentType: "application/json",
      deliveryCount: 2,
      deadLetterReason: "MaxDeliveryCountExceeded",
      applicationProperties: { tenant: 1 },
      body: Buffer.from('{"accountId":"42"}', "utf8"),
    });

    assert.deepEqual(summary, {
      sequenceNumber: "42",
      messageId: "m-1",
      enqueuedTime: "2026-10-14T10:00:00.000Z",
      subject: "SubscriptionCompleted",
      contentType: "application/json",
      deliveryCount: 2,
      correlationId: null,
      deadLetterReason: "MaxDeliveryCountExceeded",
      applicationProperties: { tenant: 1 },
      body: { accountId: "42" },
    });
  });

  it("leaves a decoded object body as it is, keeps plain text and cuts a long body", () => {
    assert.deepEqual(messageSummary({ body: { a: 1 } }).body, { a: 1 });
    assert.equal(messageSummary({ body: "not json" }).body, "not json");
    assert.match(String(messageSummary({ body: "x".repeat(5_000) }).body), /\[cut at 4000 of 5000 characters\]$/);
  });
});
