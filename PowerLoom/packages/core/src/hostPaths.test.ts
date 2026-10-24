import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containerPathOf } from "./hostPaths";

const FOLDERS = [
  { hostRoot: "D:/Claude", mount: "/vaults" },
  { hostRoot: "D:\\Projects\\", mount: "/repos" },
];

describe("a file named by its PC path", () => {
  it("is read through the mount of the folder it lies in, backslashes and case as Windows writes them", () => {
    assert.equal(containerPathOf("D:/Claude/work/specs/export.pdf", FOLDERS), "/vaults/work/specs/export.pdf");
    assert.equal(containerPathOf("d:\\projects\\Billing\\docs\\a b.md", FOLDERS), "/repos/Billing/docs/a b.md");
  });

  it("is refused outside the mounted folders, through a .. escape, or in a folder that only starts like one", () => {
    assert.equal(containerPathOf("C:/Users/me/secret.txt", FOLDERS), null);
    assert.equal(containerPathOf("D:/Claude/../Windows/win.ini", FOLDERS), null);
    assert.equal(containerPathOf("D:/ClaudeOther/x.md", FOLDERS), null);
  });
});
