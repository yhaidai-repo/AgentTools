import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readOnlyProblem } from "./readOnlyStatement";

describe("readOnlyProblem", () => {
  it("lets one SELECT or WITH query run, with or without a closing semicolon", () => {
    const queries = [
      "SELECT TOP 10 * FROM dbo.Patient WHERE Id = 5",
      "select count(*) from Patient;",
      "WITH recent AS (SELECT * FROM Verification WHERE CreatedAt > '2026-01-01') SELECT * FROM recent",
      "  -- latest first\n  SELECT * FROM Verification ORDER BY CreatedAt DESC",
    ];

    assert.deepEqual(queries.map(readOnlyProblem), [null, null, null, null]);
  });

  it("ignores forbidden words inside strings, quoted names and comments", () => {
    const queries = [
      "SELECT * FROM Note WHERE Text = 'please delete; then drop it'",
      "SELECT [Update], [Set] FROM [Insert]",
      "SELECT \"Delete\" FROM Audit",
      "SELECT 1 /* drop table x; */ -- exec sp_who",
      "SELECT 'it''s; insert' AS Note",
    ];

    assert.deepEqual(queries.map(readOnlyProblem), [null, null, null, null, null]);
  });

  it("refuses writes, schema changes and procedures, also behind a SELECT", () => {
    const queries = [
      "DELETE FROM Patient",
      "SELECT 1 DROP TABLE Patient",
      "WITH x AS (SELECT * FROM Patient) DELETE FROM x",
      "SELECT * INTO Copy FROM Patient",
      "SELECT 1 EXEC xp_cmdshell 'dir'",
      "SELECT * FROM OPENROWSET('SQLNCLI', 'Server=x', 'SELECT 1')",
    ];

    assert.ok(queries.map(readOnlyProblem).every((problem) => problem !== null));
  });

  it("refuses statements that could lift the caps or end the rolled-back transaction", () => {
    const queries = ["SELECT 1 SET ROWCOUNT 0 SELECT * FROM Patient", "SELECT 1 COMMIT", "SELECT 1 BEGIN TRAN"];

    assert.deepEqual(queries.map(readOnlyProblem), [
      "Read only: SET isn't allowed in a query (a column or table with that name goes in brackets, e.g. [SET]).",
      "Read only: COMMIT isn't allowed in a query (a column or table with that name goes in brackets, e.g. [COMMIT]).",
      "Read only: BEGIN isn't allowed in a query (a column or table with that name goes in brackets, e.g. [BEGIN]).",
    ]);
  });

  it("refuses advancing a sequence, which a rollback doesn't undo", () => {
    assert.equal(readOnlyProblem("SELECT NEXT VALUE FOR dbo.InvoiceNumber"), "Read only: NEXT VALUE FOR advances a sequence, and a rollback doesn't undo that; read sys.sequences instead.");
    assert.notEqual(readOnlyProblem("SELECT next\n value  for Seq"), null);
  });

  it("refuses table hints that hold locks, but keeps paging and dirty reads", () => {
    const refused = ["SELECT * FROM Patient WITH (TABLOCKX)", "SELECT * FROM Patient WITH (UPDLOCK, ROWLOCK)", "SELECT * FROM Patient (HOLDLOCK)", "SELECT * FROM Patient WITH (XLOCK)"];
    const allowed = ["SELECT * FROM Patient WITH (NOLOCK) ORDER BY Id OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY", "SELECT [Next], [Value] FROM Setting"];

    assert.ok(refused.map(readOnlyProblem).every((problem) => problem !== null));
    assert.deepEqual(allowed.map(readOnlyProblem), [null, null]);
  });

  it("refuses a second statement, an empty text and anything not starting with SELECT or WITH", () => {
    assert.equal(readOnlyProblem("SELECT 1; SELECT 2"), "One statement per query: remove the ';' between statements.");
    assert.equal(readOnlyProblem(" -- nothing\n "), "The query is empty.");
    assert.equal(readOnlyProblem("sp_who"), "Only a SELECT (or WITH … SELECT) query may run.");
  });

  it("checks an unclosed string or comment as code", () => {
    assert.notEqual(readOnlyProblem("SELECT 'x FROM t; DROP TABLE t"), null);
    assert.notEqual(readOnlyProblem("SELECT 1 /* DELETE FROM t"), null);
  });
});
