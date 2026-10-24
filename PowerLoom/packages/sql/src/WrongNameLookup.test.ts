import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WrongNameLookup } from "./WrongNameLookup";
import type { MetadataRows } from "./models/MetadataRows";

// A database with dbo.Verification and dbo.Patient: answers the lookups by what they ask for.
function fakeDatabase(asked: string[]): MetadataRows {
  return async (text, params) => {
    asked.push(text.split("\n")[0]);

    if (text.includes("FROM (VALUES")) {
      return Object.values(params).includes("dbo.Verification")
        ? [["dbo.Verification", "Id", "int", "PK", ""], ["dbo.Verification", "Status", "nvarchar", "", ""], ["dbo.Verification", "PatientId", "int", "", "dbo.Patient.Id"]]
        : [];
    }

    if (text.includes("c.name IN")) {
      return Object.values(params).includes("FullName") ? [["FullName", "dbo.Patient"]] : [];
    }

    return [["dbo.Patient"], ["dbo.Verification"]];
  };
}

describe("WrongNameLookup", () => {
  it("answers every wrong name of a failed query from the database's catalogue", async () => {
    const asked: string[] = [];
    const errors = [
      { number: 207, message: "Invalid column name 'VerificationStatus'." },
      { number: 207, message: "Invalid column name 'FullName'." },
      { number: 208, message: "Invalid object name 'dbo.Patients'." },
    ];
    const text = "SELECT v.VerificationStatus, p.FullName FROM dbo.Verification v JOIN dbo.Patients p ON p.Id = v.PatientId";

    const hint = await new WrongNameLookup(fakeDatabase(asked)).hint(text, errors);

    assert.equal(
      hint,
      [
        "Wrong names:",
        "- FullName: not in this query's tables; a column of that name is in dbo.Patient",
        "- v.VerificationStatus: not in dbo.Verification AS v; closest: v.Status; no table or view of this database has a column of that name",
        "Columns of this query's tables, as the database has them:",
        "- dbo.Verification AS v: Id int PK, Status nvarchar, PatientId int FK dbo.Patient.Id",
        "- dbo.Patients: no such table or view; closest: dbo.Patient",
        "Describe a table for all its column details, or list the tables to find one.",
      ].join("\n"),
    );
    assert.equal(asked.length, 3);
  });

  it("asks nothing more when the query's tables have every name", async () => {
    const asked: string[] = [];
    const errors = [{ number: 209, message: "Ambiguous column name 'Id'." }];

    await new WrongNameLookup(fakeDatabase(asked)).hint("SELECT Id FROM dbo.Verification", errors);

    assert.equal(asked.length, 1);
  });
});
