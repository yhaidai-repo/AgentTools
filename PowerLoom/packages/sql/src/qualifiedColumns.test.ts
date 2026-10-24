import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergedWrongNames, unknownQualifiedColumns } from "./qualifiedColumns";

const FOUND = [
  { table: "dbo.Verification", columns: [{ name: "Id", type: "int", key: "PK", references: "" }, { name: "Status", type: "nvarchar", key: "", references: "" }] },
  { table: "membership.Tenant", columns: [{ name: "TenantId", type: "int", key: "PK", references: "" }] },
];

describe("unknownQualifiedColumns", () => {
  it("names every alias.column the alias's table lacks, ignoring case and brackets", () => {
    const text = "SELECT v.status, [v].[VerificationStatus], v.*, t.Id FROM dbo.Verification v JOIN membership.Tenant t ON t.Id = v.TenantId";
    const aliases = [{ table: "dbo.Verification", alias: "v" }, { table: "membership.Tenant", alias: "t" }];

    assert.deepEqual(unknownQualifiedColumns(text, aliases, FOUND), [
      { kind: "column", name: "v.VerificationStatus" },
      { kind: "column", name: "v.TenantId" },
      { kind: "column", name: "t.Id" },
    ]);
  });

  it("checks a table without an alias by its own name, and not inside a longer name", () => {
    const text = "SELECT Verification.Stat, dbo.Verification.Other FROM dbo.Verification";

    assert.deepEqual(unknownQualifiedColumns(text, [{ table: "dbo.Verification", alias: "" }], FOUND), [{ kind: "column", name: "Verification.Stat" }]);
  });
});

describe("mergedWrongNames", () => {
  it("keeps the server's names first and drops a bare column the query check names with its alias", () => {
    const server = [{ kind: "column" as const, name: "Id" }, { kind: "table" as const, name: "dbo.Nothing" }];
    const checked = [{ kind: "column" as const, name: "t.Id" }, { kind: "column" as const, name: "v.Stat" }];

    assert.deepEqual(mergedWrongNames(server, checked), [{ kind: "table", name: "dbo.Nothing" }, ...checked]);
  });
});
