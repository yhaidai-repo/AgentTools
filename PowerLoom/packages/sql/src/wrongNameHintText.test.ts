import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namesHintText } from "./wrongNameHintText";
import type { WrongNameFacts } from "./models/WrongNameFacts";

const FACILITY = {
  table: "dbo.Facility",
  columns: [
    { name: "FacilityId", type: "int", key: "PK", references: "" },
    { name: "TenantId", type: "int", key: "", references: "membership.Tenant.TenantId" },
    { name: "Title", type: "nvarchar", key: "", references: "" },
  ],
};
const VISIT = {
  table: "dbo.Visit",
  columns: [
    { name: "VisitId", type: "int", key: "PK", references: "" },
    { name: "FacilityId", type: "int", key: "", references: "dbo.Facility.FacilityId" },
    { name: "Title", type: "nvarchar", key: "", references: "" },
  ],
};
const ALIASES = [{ table: "dbo.Facility", alias: "f" }, { table: "dbo.Visit", alias: "v" }];

function facts(overrides: Partial<WrongNameFacts>): WrongNameFacts {
  return { wrong: [], aliases: ALIASES, found: [FACILITY, VISIT], missing: [], elsewhere: [], ...overrides };
}

// The lines under "Wrong names:", up to the tables' section.
function wrongLines(text: string): string[] {
  const lines = text.split("\n");
  const end = lines.findIndex((line) => line.startsWith("Columns of"));

  return lines.slice(lines.indexOf("Wrong names:") + 1, end);
}

describe("namesHintText", () => {
  it("names each wrong column's closest match, then the query's tables with types and keys", () => {
    const text = namesHintText(facts({ wrong: [{ kind: "column", name: "FacilityID_" }], elsewhere: [{ column: "FacilityID_", tables: [] }] }));

    assert.equal(
      text,
      [
        "Wrong names:",
        "- FacilityID_: not in this query's tables; closest: f.FacilityId, v.FacilityId; no table or view of this database has a column of that name",
        "Columns of this query's tables, as the database has them:",
        "- dbo.Facility AS f: FacilityId int PK, TenantId int FK membership.Tenant.TenantId, Title nvarchar",
        "- dbo.Visit AS v: VisitId int PK, FacilityId int FK dbo.Facility.FacilityId, Title nvarchar",
        "Describe a table for all its column details, or list the tables to find one.",
      ].join("\n"),
    );
  });

  it("says when a wrong column is in another of the query's tables", () => {
    const text = namesHintText(facts({ wrong: [{ kind: "column", name: "VisitId" }] }));

    assert.deepEqual(wrongLines(text), ["- VisitId: it's a column of dbo.Visit AS v: check which table's alias it's written with"]);
  });

  it("looks for a qualified column in its own table, with the primary key first for an Id", () => {
    const text = namesHintText(facts({ wrong: [{ kind: "column", name: "f.Id" }, { kind: "column", name: "v.Titel" }] }));

    assert.deepEqual(wrongLines(text), ["- f.Id: not in dbo.Facility AS f; closest: f.FacilityId", "- v.Titel: not in dbo.Visit AS v; closest: v.Title"]);
  });

  it("says where a column the query's tables lack is in the database", () => {
    const text = namesHintText(facts({ wrong: [{ kind: "column", name: "AccountId" }], elsewhere: [{ column: "AccountId", tables: ["dbo.Account"] }] }));

    assert.deepEqual(wrongLines(text), ["- AccountId: not in this query's tables; a column of that name is in dbo.Account"]);
  });

  it("names the tables of an ambiguous column", () => {
    const text = namesHintText(facts({ wrong: [{ kind: "ambiguous", name: "Title" }] }));

    assert.deepEqual(wrongLines(text), ["- Title: it's in dbo.Facility AS f, dbo.Visit AS v: write it with the alias of the one you mean"]);
  });

  it("explains an unbound qualifier: unknown, a table written instead of its alias, or an alias out of scope", () => {
    const text = namesHintText(facts({
      wrong: [
        { kind: "unbound", name: "x.Title" },
        { kind: "unbound", name: "dbo.Facility.TenantId" },
        { kind: "unbound", name: "v.VisitId" },
      ],
    }));

    assert.deepEqual(wrongLines(text), [
      "- x.Title: x is no table or alias of this query's FROM or JOIN (dbo.Facility AS f, dbo.Visit AS v); Title is in dbo.Facility AS f, dbo.Visit AS v",
      "- dbo.Facility.TenantId: dbo.Facility has the alias f in this query: write f.TenantId; TenantId is in dbo.Facility AS f",
      "- v.VisitId: v is the alias of dbo.Visit, but not where it's used (an alias inside a subquery stays there; a JOIN's alias starts at its JOIN); VisitId is in dbo.Visit AS v",
    ]);
  });

  it("lists a missing table with the same name elsewhere and the closest names, without repeating it as a wrong name", () => {
    const text = namesHintText(facts({
      wrong: [{ kind: "table", name: "dbo.Tenant" }],
      found: [],
      missing: [{ table: "dbo.Tenant", sameName: ["membership.Tenant"], closest: ["membership.Tenants"] }],
    }));

    assert.equal(
      text,
      [
        "Columns of this query's tables, as the database has them:",
        "- dbo.Tenant: no such table or view; same name in membership.Tenant; closest: membership.Tenants",
        "Describe a table for all its column details, or list the tables to find one.",
      ].join("\n"),
    );
  });

  it("is the describe hint alone when nothing was found", () => {
    assert.equal(namesHintText(facts({ aliases: [], found: [] })), "Describe a table for all its column details, or list the tables to find one.");
  });
});
