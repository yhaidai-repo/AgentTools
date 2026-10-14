import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readOnlyMongoString } from "./readOnlyMongoString";

describe("readOnlyMongoString", () => {
  it("picks the primary read-only MongoDB string over the secondary and the read-write ones", () => {
    const strings = [
      { connectionString: "mongodb://a:rw1@a.mongo.cosmos.azure.com:10255/?ssl=true", description: "Primary MongoDB Connection String", keyKind: "Primary", type: "MongoDB" },
      { connectionString: "mongodb://a:ro2@a.mongo.cosmos.azure.com:10255/?ssl=true", description: "Secondary Read-Only MongoDB Connection String", keyKind: "SecondaryReadonly", type: "MongoDB" },
      { connectionString: "mongodb://a:ro1@a.mongo.cosmos.azure.com:10255/?ssl=true", description: "Primary Read-Only MongoDB Connection String", keyKind: "PrimaryReadonly", type: "MongoDB" },
      { connectionString: "AccountEndpoint=https://a.documents.azure.com:443/;AccountKey=ro3", description: "Primary Read-Only SQL Connection String", keyKind: "PrimaryReadonly", type: "Sql" },
    ];

    assert.equal(readOnlyMongoString(strings), "mongodb://a:ro1@a.mongo.cosmos.azure.com:10255/?ssl=true");
  });

  it("falls back to any read-only string by its description and answers null for an account without one", () => {
    assert.equal(readOnlyMongoString([{ connectionString: "mongodb://a:ro@h/?x", description: "Secondary Read-Only MongoDB Connection String" }]), "mongodb://a:ro@h/?x");
    assert.equal(readOnlyMongoString([{ connectionString: "mongodb://a:rw@h/?x", description: "Primary MongoDB Connection String", keyKind: "Primary" }]), null);
    assert.equal(readOnlyMongoString([]), null);
  });
});
