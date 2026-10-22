import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configOf } from "./SqlReader";

const CONNECTION_STRING = "Server=host.docker.internal,1433;Database=Pvs_Development;User ID=reader;Password=secret";

describe("configOf", () => {
  it("keeps the connection string's database when the call names none", () => {
    const config = configOf(CONNECTION_STRING);

    assert.equal(config.database, "Pvs_Development");
  });

  it("opens the database the call names instead of the connection string's", () => {
    const config = configOf(CONNECTION_STRING, "Pvs_Stage");

    assert.equal(config.database, "Pvs_Stage");
    assert.equal(config.server, "host.docker.internal");
  });

  it("treats a blank database as none", () => {
    const config = configOf(CONNECTION_STRING, "   ");

    assert.equal(config.database, "Pvs_Development");
  });

  it("keeps the reader's caps whatever the database", () => {
    const config = configOf(CONNECTION_STRING, "Pvs_Stage");

    assert.equal(config.options?.readOnlyIntent, true);
    assert.deepEqual(config.pool, { min: 0, max: 1 });
  });
});
