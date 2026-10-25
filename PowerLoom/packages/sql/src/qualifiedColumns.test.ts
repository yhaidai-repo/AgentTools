import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergedWrongNames, unknownQualifiedColumns } from "./qualifiedColumns";

const FOUND = [
  { table: "dbo.Subscription", columns: [{ name: "Id", type: "int", key: "PK", references: "" }, { name: "Status", type: "nvarchar", key: "", references: "" }] },
  { table: "membership.Tenant", columns: [{ name: "TenantId", type: "int", key: "PK", references: "" }] },
];

describe("unknownQualifiedColumns", () => {
  it("names every alias.column the alias's table lacks, ignoring case and brackets", () => {
    const text = "SELECT v.status, [v].[SubscriptionStatus], v.*, t.Id FROM dbo.Subscription v JOIN membership.Tenant t ON t.Id = v.TenantId";
    const aliases = [{ table: "dbo.Subscription", alias: "v" }, { table: "membership.Tenant", alias: "t" }];

    assert.deepEqual(unknownQualifiedColumns(text, aliases, FOUND), [
      { kind: "column", name: "v.SubscriptionStatus" },
      { kind: "column", name: "v.TenantId" },
      { kind: "column", name: "t.Id" },
    ]);
  });

  it("doesn't take a string literal or a comment for a column", () => {
    const text = "SELECT v.Status FROM dbo.Subscription v WHERE v.Status <> 'see v.Nope' -- v.Other";

    assert.deepEqual(unknownQualifiedColumns(text, [{ table: "dbo.Subscription", alias: "v" }], FOUND), []);
  });

  it("checks a table without an alias by its own name, and not inside a longer name", () => {
    const text = "SELECT Subscription.Stat, dbo.Subscription.Other FROM dbo.Subscription";

    assert.deepEqual(unknownQualifiedColumns(text, [{ table: "dbo.Subscription", alias: "" }], FOUND), [{ kind: "column", name: "Subscription.Stat" }]);
  });
});

describe("mergedWrongNames", () => {
  it("keeps the server's names first and drops a bare column the query check names with its alias", () => {
    const server = [{ kind: "column" as const, name: "Id" }, { kind: "table" as const, name: "dbo.Nothing" }];
    const checked = [{ kind: "column" as const, name: "t.Id" }, { kind: "column" as const, name: "v.Stat" }];

    assert.deepEqual(mergedWrongNames(server, checked), [{ kind: "table", name: "dbo.Nothing" }, ...checked]);
  });
});
