import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GENERAL_IMAGE, imageNamed, readImageCatalog } from "./imageCatalog";

function catalogFile(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "catalog-")), "sandbox-images.json");

  writeFileSync(path, JSON.stringify(content));

  return path;
}

test("without a file the catalog is the general image", () => {
  assert.deepEqual(readImageCatalog(undefined), [GENERAL_IMAGE]);
});

test("a vault picks by name; empty is the first entry; an unknown name is no image", () => {
  const catalog = readImageCatalog(catalogFile({ images: [{ name: "general", image: "powerloom-sandbox" }, { name: "java", image: "team/sandbox-java:1", description: "JDK 21" }, { name: "" }] }));

  assert.deepEqual(catalog.map((entry) => entry.name), ["general", "java"]);
  assert.equal(imageNamed(catalog, "")?.image, "powerloom-sandbox");
  assert.equal(imageNamed(catalog, "java")?.image, "team/sandbox-java:1");
  assert.equal(imageNamed(catalog, "go"), null);
});
