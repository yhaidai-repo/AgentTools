import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addRegisterRecordCommand } from "@powerloom/core";

const RECORD = { vault: "work", project: "pvs", kind: "issues", title: "Wrong total", text: "Sums twice.\nSee #42 in the log." };

describe("register_add input", () => {
  it("takes a one-line title and a text over several lines", () => {
    assert.equal(addRegisterRecordCommand.input.safeParse(RECORD).success, true);
  });

  it("refuses a title, a default or an option over two lines, and a heading line in the text", () => {
    const fakes = [
      { ...RECORD, title: "Wrong total\n## KI-999 Fake" },
      { ...RECORD, text: "Sums twice.\n## KI-998 Fake" },
      { ...RECORD, default: ["a\nb"] },
      { ...RECORD, options: ["a\r\n# b"] },
    ];

    assert.deepEqual(fakes.map((fake) => addRegisterRecordCommand.input.safeParse(fake).success), [false, false, false, false]);
  });
});
