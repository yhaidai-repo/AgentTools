import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { columnHomesSql, columnsElsewhere, columnsSql, groupColumns, missingTables, namedParams } from "./wrongNameHint";

describe("lookup SQL", () => {
  it("numbers one parameter per table or column", () => {
    assert.match(columnsSql(2), /\(VALUES \(0, @t0\), \(1, @t1\)\) AS r\(i, ref\)/);
    assert.match(columnHomesSql(2), /c\.name IN \(@c0, @c1\)/);
    assert.deepEqual(namedParams("t", ["dbo.Facility", "dbo.Tenant"]), { t0: "dbo.Facility", t1: "dbo.Tenant" });
  });

  it("reads each column's type, key and reference", () => {
    assert.match(columnsSql(1), /JOIN sys\.types t/);
    assert.match(columnsSql(1), /is_primary_key = 1/);
    assert.match(columnsSql(1), /sys\.foreign_key_columns/);
  });
});

describe("groupColumns", () => {
  it("groups the rows by table as written, each column once, and drops tables without columns", () => {
    const rows = [
      ["dbo.Facility", "FacilityId", "int", "PK", ""],
      ["dbo.Facility", "TenantId", "int", "", "membership.Tenant.TenantId"],
      ["dbo.Facility", "TenantId", "int", "", "membership.Tenant.OtherId"],
    ];

    assert.deepEqual(groupColumns(["dbo.Facility", "dbo.Nothing"], rows), [
      {
        table: "dbo.Facility",
        columns: [
          { name: "FacilityId", type: "int", key: "PK", references: "" },
          { name: "TenantId", type: "int", key: "", references: "membership.Tenant.TenantId" },
        ],
      },
    ]);
  });
});

describe("missingTables", () => {
  it("names the same table in other schemas and the closest other names", () => {
    const names = ["dbo.Facility", "membership.Tenant", "membership.Tenants", "dbo.Visit"];

    assert.deepEqual(missingTables(["dbo.Tenant", "dbo.Facilities", "dbo.Nothing"], names), [
      { table: "dbo.Tenant", sameName: ["membership.Tenant"], closest: ["membership.Tenants"] },
      { table: "dbo.Facilities", sameName: [], closest: ["dbo.Facility"] },
      { table: "dbo.Nothing", sameName: [], closest: [] },
    ]);
  });
});

describe("columnsElsewhere", () => {
  it("lists the tables that have each column, ignoring case", () => {
    const rows = [["AccountId", "dbo.Account"], ["accountid", "dbo.Visit"]];

    assert.deepEqual(columnsElsewhere(["AccountId", "Nope"], rows), [
      { column: "AccountId", tables: ["dbo.Account", "dbo.Visit"] },
      { column: "Nope", tables: [] },
    ]);
  });
});
