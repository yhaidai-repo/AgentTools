import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WrongNameLookup } from "./WrongNameLookup";
import type { MetadataRows } from "./models/MetadataRows";

// A database with dbo.Subscription and dbo.Account: answers the lookups by what they ask for.
function fakeDatabase(asked: string[]): MetadataRows {
  return async (text, params) => {
    asked.push(text.split("\n")[0]);

    if (text.includes("FROM (VALUES")) {
      return Object.values(params).includes("dbo.Subscription")
        ? [["dbo.Subscription", "Id", "int", "PK", ""], ["dbo.Subscription", "Status", "nvarchar", "", ""], ["dbo.Subscription", "AccountId", "int", "", "dbo.Account.Id"]]
        : [];
    }

    if (text.includes("c.name IN")) {
      return Object.values(params).includes("FullName") ? [["FullName", "dbo.Account"]] : [];
    }

    return [["dbo.Account"], ["dbo.Subscription"]];
  };
}

describe("WrongNameLookup", () => {
  it("answers every wrong name of a failed query from the database's catalogue", async () => {
    const asked: string[] = [];
    const errors = [
      { number: 207, message: "Invalid column name 'SubscriptionStatus'." },
      { number: 207, message: "Invalid column name 'FullName'." },
      { number: 208, message: "Invalid object name 'dbo.Accounts'." },
    ];
    const text = "SELECT v.SubscriptionStatus, p.FullName FROM dbo.Subscription v JOIN dbo.Accounts p ON p.Id = v.AccountId";

    const hint = await new WrongNameLookup(fakeDatabase(asked)).hint(text, errors);

    assert.equal(
      hint,
      [
        "Wrong names:",
        "- FullName: not in this query's tables; a column of that name is in dbo.Account",
        "- v.SubscriptionStatus: not in dbo.Subscription AS v; closest: v.Status; no table or view of this database has a column of that name",
        "Columns of this query's tables, as the database has them:",
        "- dbo.Subscription AS v: Id int PK, Status nvarchar, AccountId int FK dbo.Account.Id",
        "- dbo.Accounts: no such table or view; closest: dbo.Account",
        "Describe a table for all its column details, or list the tables to find one.",
      ].join("\n"),
    );
    assert.equal(asked.length, 3);
  });

  it("asks nothing more when the query's tables have every name", async () => {
    const asked: string[] = [];
    const errors = [{ number: 209, message: "Ambiguous column name 'Id'." }];

    await new WrongNameLookup(fakeDatabase(asked)).hint("SELECT Id FROM dbo.Subscription", errors);

    assert.equal(asked.length, 1);
  });
});
