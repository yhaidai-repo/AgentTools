import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bareName, queriedTables, referencedTables, sqlCode, tableAliases } from "./queryTables";

describe("referencedTables", () => {
  it("finds the tables after FROM and JOIN, with aliases left out", () => {
    const text = "SELECT f.Id, t.Name FROM dbo.Facility f JOIN dbo.Tenant t ON t.Id = f.TenantId";

    assert.deepEqual(referencedTables(text), ["dbo.Facility", "dbo.Tenant"]);
  });

  it("keeps brackets and database parts, and names each table once", () => {
    const text = "SELECT 1 FROM [Pos].[dbo].[Facility] a LEFT JOIN Facility b ON 1 = 1 inner join FACILITY c ON 1 = 1";

    assert.deepEqual(referencedTables(text), ["[Pos].[dbo].[Facility]", "Facility"]);
  });

  it("leaves out the query's own CTEs and subqueries", () => {
    const text = "WITH recent (Id) AS (SELECT Id FROM dbo.Subscription), other AS (SELECT 1 AS x) SELECT * FROM recent JOIN (SELECT 1 AS y) s ON 1 = 1";

    assert.deepEqual(referencedTables(text), ["dbo.Subscription"]);
  });

  it("is empty for a query without tables", () => {
    assert.deepEqual(referencedTables("SELECT 1 AS Name"), []);
  });

  it("finds a table right after another without an alias", () => {
    assert.deepEqual(referencedTables("SELECT 1 FROM dbo.Facility JOIN dbo.Tenant ON 1 = 1"), ["dbo.Facility", "dbo.Tenant"]);
  });
});

describe("tableAliases", () => {
  it("gives each table its alias, with or without AS, and none before a keyword", () => {
    const text = "SELECT 1 FROM dbo.Facility AS f JOIN [membership].[Tenant] [t] ON 1 = 1 LEFT JOIN dbo.Visit WITH (NOLOCK) ON 1 = 1 WHERE 1 = 1";

    assert.deepEqual(tableAliases(text), [
      { table: "dbo.Facility", alias: "f" },
      { table: "[membership].[Tenant]", alias: "t" },
      { table: "dbo.Visit", alias: "" },
    ]);
  });
});

describe("sqlCode", () => {
  it("drops string literals and comments, quotes inside a literal included", () => {
    const text = "SELECT v.Id -- from dbo.Old o\nFROM dbo.Subscription v /* JOIN dbo.Gone g */ WHERE v.Note = 'it''s from x.Nope'";

    assert.equal(sqlCode(text), "SELECT v.Id  \nFROM dbo.Subscription v   WHERE v.Note = ''");
    assert.deepEqual(referencedTables(text), ["dbo.Subscription"]);
  });
});

describe("queriedTables", () => {
  it("puts the tables the server called wrong first, each table once", () => {
    const aliases = [{ table: "dbo.Facility", alias: "f" }, { table: "[dbo].[Facilities]", alias: "x" }];

    assert.deepEqual(queriedTables(aliases, [{ kind: "table", name: "dbo.Facilities" }, { kind: "column", name: "Id" }]), ["dbo.Facilities", "dbo.Facility"]);
  });
});

describe("bareName", () => {
  it("drops the schema and brackets", () => {
    assert.equal(bareName("[membership].[Tenant]"), "Tenant");
    assert.equal(bareName("Tenant"), "Tenant");
  });
});
