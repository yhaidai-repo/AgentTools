import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { secretFileProblem } from "./attachablePath";

describe("secretFileProblem", () => {
  it("refuses secret folders and files, whatever the case", () => {
    const refused = [
      "/repos/dev-secrets/README.md",
      "/repos/POS/.env",
      "/repos/POS/.env.local",
      "/repos/POS/certs/site.PFX",
      "/repos/POS/.git/config",
      "/repos/home/.ssh/id_ed25519.pub",
      "/repos/tool/auth.json",
    ];

    assert.deepEqual(refused.filter((path) => secretFileProblem(path) === null), []);
  });

  it("lets documents and sample env files through", () => {
    const allowed = ["/vaults/work/specs/export.pdf", "/repos/POS/docs/keys-and-ids.md", "/repos/POS/.env.example", "/repos/POS/src/secretary.ts"];

    assert.deepEqual(allowed.filter((path) => secretFileProblem(path) !== null), []);
  });
});
