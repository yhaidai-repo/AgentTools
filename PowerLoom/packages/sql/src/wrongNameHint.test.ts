import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bareName, columnsSql, groupColumns, isWrongNameError, missingTables, namedParams, namesHintText, referencedTables, sameNameSql } from "./wrongNameHint";

describe("isWrongNameError", () => {
  it("is true for an invalid column or object name only", () => {
    assert.equal(isWrongNameError(207), true);
    assert.equal(isWrongNameError(208), true);
    assert.equal(isWrongNameError(102), false);
    assert.equal(isWrongNameError(undefined), false);
  });
});

describe("referencedTables", () => {
  it("finds the tables after FROM and JOIN, with aliases left out", () => {
    const text = "SELECT f.Id, t.Name FROM dbo.Facility f JOIN dbo.Tenant t ON t.Id = f.TenantId";

    assert.deepEqual(referencedTables(text), ["dbo.Facility", "dbo.Tenant"]);
  });

  it("keeps brackets and database parts, and names each table once", () => {
    const text = "SELECT 1 FROM [Pvs].[dbo].[Facility] a LEFT JOIN Facility b ON 1 = 1 inner join FACILITY c ON 1 = 1";

    assert.deepEqual(referencedTables(text), ["[Pvs].[dbo].[Facility]", "Facility"]);
  });

  it("leaves out the query's own CTEs and subqueries", () => {
    const text = "WITH recent (Id) AS (SELECT Id FROM dbo.Verification), other AS (SELECT 1 AS x) SELECT * FROM recent JOIN (SELECT 1 AS y) s ON 1 = 1";

    assert.deepEqual(referencedTables(text), ["dbo.Verification"]);
  });

  it("is empty for a query without tables", () => {
    assert.deepEqual(referencedTables("SELECT 1 AS Name"), []);
  });
});

describe("bareName", () => {
  it("drops the schema and brackets", () => {
    assert.equal(bareName("[membership].[Tenant]"), "Tenant");
    assert.equal(bareName("Tenant"), "Tenant");
  });
});

describe("lookup SQL", () => {
  it("numbers one parameter per table", () => {
    assert.match(columnsSql(2), /\(VALUES \(0, @t0\), \(1, @t1\)\) AS r\(i, ref\)/);
    assert.match(sameNameSql(2), /o\.name IN \(@n0, @n1\)/);
    assert.deepEqual(namedParams("t", ["dbo.Facility", "dbo.Tenant"]), { t0: "dbo.Facility", t1: "dbo.Tenant" });
  });
});

describe("namesHintText", () => {
  it("lists the found tables' columns and where a missing table lives", () => {
    const found = groupColumns(["dbo.Facility", "dbo.Tenant"], [["dbo.Facility", "FacilityId"], ["dbo.Facility", "Title"]]);
    const missing = missingTables(["dbo.Tenant", "dbo.Nothing"], [["Tenant", "membership.Tenant"]]);

    assert.equal(
      namesHintText(found, missing),
      [
        "Names in this query, as the database has them:",
        "- dbo.Facility: FacilityId, Title",
        "- dbo.Tenant: no such table or view; same name in membership.Tenant",
        "- dbo.Nothing: no such table or view",
        "Describe a table for its column types and keys, or list the tables to find one.",
      ].join("\n"),
    );
  });
});
