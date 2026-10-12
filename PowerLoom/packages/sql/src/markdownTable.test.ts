import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toMarkdownTable } from "./markdownTable";

describe("toMarkdownTable", () => {
  it("writes a header, a divider and one line per row", () => {
    const table = toMarkdownTable(["Id", "Name"], [[1, "Ann"], [2, null]]);

    assert.equal(table, "| Id | Name |\n| --- | --- |\n| 1 | Ann |\n| 2 | NULL |");
  });

  it("keeps each row on one line and escapes pipes", () => {
    const table = toMarkdownTable(["Note"], [["first\r\nsecond | third"]]);

    assert.equal(table.split("\n")[2], "| first second \\| third |");
  });

  it("writes dates as ISO, binary as hex and cuts long values", () => {
    const row = [new Date("2026-10-12T08:30:00Z"), Buffer.from([0xab, 0x01]), "x".repeat(400)];
    const cells = toMarkdownTable(["At", "Hash", "Text"], [row]).split("\n")[2].split(" | ");

    assert.equal(cells[0], "| 2026-10-12T08:30:00.000Z");
    assert.equal(cells[1], "0xAB01");
    assert.equal(cells[2], `${"x".repeat(300)}… |`);
  });
});
