import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configOf, failureOf } from "./SqlReader";

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

describe("failureOf", () => {
  function serverError(number: number, message: string): Error {
    return Object.assign(new Error(message), { number });
  }

  it("gives the agent every error of the batch, not only the last", () => {
    const last = Object.assign(serverError(207, "Invalid column name 'B'."), { precedingErrors: [serverError(207, "Invalid column name 'A'.")] });

    const answer = failureOf(last);

    assert.equal(answer.ok, false);
    assert.equal(!answer.ok && answer.message, "Invalid column name 'A'.\nInvalid column name 'B'.");
    assert.deepEqual(!answer.ok && answer.errors, [{ number: 207, message: "Invalid column name 'A'." }, { number: 207, message: "Invalid column name 'B'." }]);
    assert.equal(!answer.ok && answer.errorNumber, 207);
  });

  it("keeps a driver error's message and has no server errors", () => {
    const answer = failureOf(Object.assign(new Error("Login failed"), { code: "ELOGIN" }));

    assert.deepEqual(answer, { ok: false, message: "Login failed", denied: true, errorNumber: undefined, errors: [] });
  });
});
