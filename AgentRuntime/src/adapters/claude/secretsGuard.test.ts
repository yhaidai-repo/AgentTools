import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolPolicyDecision } from "../../models/ToolPolicyDecision";
import { secretsGuard } from "./secretsGuard";

async function decide(name: string, input: Record<string, unknown>): Promise<ToolPolicyDecision> {
  return secretsGuard({ callId: "toolu_1", name, input, taskId: null, agentType: null });
}

describe("secretsGuard", () => {
  for (const [name, input] of [
    ["Read", { file_path: "D:/repo/.env" }],
    ["Read", { file_path: "D:\\repo\\.env.local" }],
    ["Edit", { file_path: "/srv/app/.env.production" }],
    ["Write", { file_path: "certs/server.pem" }],
    ["Read", { file_path: "keys/id.key" }],
    ["Read", { file_path: "src/Api/appsettings.Development.json" }],
    ["Read", { file_path: "C:/Users/me/AppData/Roaming/Microsoft/UserSecrets/abc/secrets.json" }],
    ["Read", { file_path: "D:/repo/.git/config" }],
    ["Read", { file_path: "~/.claude/.credentials.json" }],
    ["Grep", { pattern: "password", path: "D:/repo/.env" }],
    ["Glob", { pattern: "**/.env*" }],
    ["Bash", { command: "cat .env | head" }],
    ["Bash", { command: "cat ~/.git-credentials" }],
    ["PowerShell", { command: "Get-Content 'D:\\repo\\appsettings.Production.json'" }],
  ] as const) {
    it(`denies ${name} on ${JSON.stringify(input)}`, async () => {
      const decision = await decide(name, input);

      assert.equal(decision.allow, false);
      assert.match(decision.allow ? "" : decision.reason, new RegExp(`^${name} was blocked: it targets a secret file \\(.+\\)\\.$`));
    });
  }

  for (const [name, input] of [
    ["Read", { file_path: "D:/repo/.env.example" }],
    ["Read", { file_path: "D:/repo/.envrc.md" }],
    ["Read", { file_path: "src/Api/appsettings.json" }],
    ["Read", { file_path: "src/keys.ts" }],
    ["Grep", { pattern: "\\.env", path: "src" }],
    ["Bash", { command: "node -e \"console.log(process.env.HOME)\"" }],
    ["Bash", { command: "git config user.name" }],
    ["read_pbi", { file_path: ".env" }],
  ] as const) {
    it(`allows ${name} on ${JSON.stringify(input)}`, async () => {
      assert.deepEqual(await decide(name, input), { allow: true });
    });
  }
});
