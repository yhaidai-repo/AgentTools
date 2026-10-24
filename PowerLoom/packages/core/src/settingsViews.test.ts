import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adoView, azureView, sqlView } from "./settingsViews";

const SECRETS = ["ado-pat-secret", "Server=db;Password=sql-secret", "Endpoint=sb://bus;SharedAccessKey=bus-secret"];

describe("settings.get's views", () => {
  it("show what the Settings page shows and never a secret", () => {
    const shown = JSON.stringify([
      adoView({ enabled: true, orgUrl: "https://dev.azure.com/org", project: "P", team: "T", user: "me@x", pat: SECRETS[0] }),
      sqlView({ enabled: true, connections: [{ name: "main", server: "db", database: "app", connectionString: SECRETS[1], enabled: true }] }),
      azureView({ enabledKinds: { serviceBus: true }, subscription: "sub", resources: [{ name: "bus", kind: "serviceBus", target: "bus.servicebus.windows.net", secret: SECRETS[2], display: "bus", enabled: true }] }, "me@x"),
    ]);

    for (const secret of SECRETS) {
      assert.equal(shown.includes(secret), false, secret);
    }

    assert.match(shown, /"hasToken":true/);
    assert.match(shown, /"server":"db"/);
    assert.match(shown, /"signedInAs":"me@x"/);
  });

  it("say no token is saved for a vault without its integration", () => {
    assert.deepEqual(adoView(null), { enabled: false, configured: false, orgUrl: "", project: "", team: "", user: "", hasToken: false });
  });
});
