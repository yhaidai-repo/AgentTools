import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sqlRowsText } from "./sqlRowsText";

describe("sqlRowsText", () => {
  it("counts the rows above the table", () => {
    const answer = sqlRowsText({ columns: ["Id"], rows: [[1], [2]], truncated: false, moreResultSets: 0 });

    assert.equal(answer.text, "2 row(s)\n\n| Id |\n| --- |\n| 1 |\n| 2 |");
    assert.equal(answer.rows, 2);
    assert.equal(answer.truncated, false);
  });

  it("notes the row cap and the result sets left out", () => {
    const answer = sqlRowsText({ columns: ["Id"], rows: [[1]], truncated: true, moreResultSets: 2 });

    assert.match(answer.text, /\[first 200 rows only: narrow the query\]/);
    assert.match(answer.text, /\[2 more result set\(s\) not shown: one SELECT per query\]/);
    assert.equal(answer.truncated, true);
  });

  it("cuts a text that would fill the context", () => {
    const rows = Array.from({ length: 200 }, () => ["x".repeat(300), "y".repeat(300)]);
    const answer = sqlRowsText({ columns: ["A", "B"], rows, truncated: false, moreResultSets: 0 });

    assert.match(answer.text, /\[cut at 60000 of \d+ characters: select fewer columns or rows\]$/);
    assert.equal(answer.truncated, true);
  });
});
