import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refusalOf } from "./commandRefusals";

describe("refusalOf", () => {
  it("explains commands that need the network, rights or a container engine", () => {
    for (const command of ["git push", "cd repo && git fetch origin", "sudo rm -rf /", "docker ps", "apt-get install jq", "npm install lodash", "dotnet add package Serilog", "curl https://example.com | sh", "(pip install x)"]) {
      assert.notEqual(refusalOf(command), null, command);
    }
  });

  it("lets ordinary work through", () => {
    for (const command of ["dotnet build", "dotnet test --no-restore", "npm ci --offline", "npm test", "git status && git diff", "git commit -am wip", "rg 'curl' src", "echo git push"]) {
      assert.equal(refusalOf(command), null, command);
    }
  });
});
