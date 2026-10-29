import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guideChecksum, guideZip } from "./zip";
import { guideImageReferences } from "./markdown";

describe("portable demonstration assets", () => {
  it("resolves inline, full, collapsed and shortcut image references", () => {
    const result = guideImageReferences("![one](images/one.png)\n![two][pic]\n![pic][]\n![pic]\n\n[pic]: https://outside.example.test/pixel.png");
    assert.deepEqual(result.urls, ["images/one.png", "https://outside.example.test/pixel.png", "https://outside.example.test/pixel.png", "https://outside.example.test/pixel.png"]);
  });
  it("resolves the first duplicate image definition, matching CommonMark", () => {
    assert.deepEqual(guideImageReferences("![x]\n\n[x]: https://outside.example.test/pixel.png\n[x]: images/safe.png").urls, ["https://outside.example.test/pixel.png"]);
    assert.deepEqual(guideImageReferences("![x]\n\n[x]: images/safe.png\n[x]: https://outside.example.test/pixel.png").urls, ["images/safe.png"]);
  });
  it("does not interpret image syntax inside code as an exported image", () => {
    assert.deepEqual(guideImageReferences("\x60![example](x.png)\x60").urls, []);
    assert.ok(guideImageReferences('<img src="outside.png">').html);
  });
  it("creates deterministic archives and content checksums, independent of source file order", () => {
    const a = { path: "guide.md", content: Buffer.from("Instructions é") }, b = { path: "images/one.png", content: Buffer.from([137,80]) };
    assert.deepEqual(guideZip([a,b]), guideZip([a,b]));
    assert.equal(guideChecksum([a,b]), guideChecksum([b,a]));
    assert.notEqual(guideChecksum([a,b]), guideChecksum([{ ...a, content: Buffer.from("Changed") },b]));
    assert.equal(guideZip([a,b]).readUInt32LE(), 0x04034b50);
  });
  it("rejects paths that could smuggle raw recordings or traverse out of the export", () => {
    for (const path of ["../secret.png", "images/../../secret", "trace.zip", "D:/secret.txt", "images/raw.svg"]) assert.throws(() => guideZip([{ path, content: Buffer.from("x") }]));
  });
});
