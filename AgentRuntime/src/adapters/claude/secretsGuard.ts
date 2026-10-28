import type { ToolPolicy } from "../../models/ToolPolicy";
import type { ToolPolicyCall } from "../../models/ToolPolicyCall";
import type { ToolPolicyDecision } from "../../models/ToolPolicyDecision";

// Claude Code's file and shell tools, with the input fields that name a path or a command. Grep's `pattern` is the
// text it searches for, not a path, so only Glob's pattern counts.
const TARGET_FIELDS: Record<string, string[]> = {
  Read: ["file_path"],
  Edit: ["file_path"],
  Write: ["file_path"],
  Grep: ["path", "glob"],
  Glob: ["path", "pattern"],
  Bash: ["command"],
  PowerShell: ["command"],
};

// Where a path segment ends: a separator, quote, shell operator or glob character, or the end of the text.
const END = String.raw`(?=$|[\s/\\"'\`;|&<>()*?,\]])`;
const START = String.raw`(?:^|[\s/\\"'\`=:(\[])`;

// Files that hold secrets: env files (an example, sample or template env file holds none), keys and certificates,
// .NET environment settings and user secrets, git remotes with stored credentials, Claude's own login.
const SECRET_FILES: { pattern: RegExp; label: string }[] = [
  { pattern: new RegExp(String.raw`${START}\.env(?!\.(?:example|sample|template)${END})(?:\.[\w.-]+)?${END}`, "i"), label: ".env file" },
  { pattern: new RegExp(String.raw`\.(?:pem|key)${END}`, "i"), label: "key or certificate" },
  { pattern: new RegExp(String.raw`${START}appsettings\.[\w.-]+\.json${END}`, "i"), label: "environment appsettings" },
  { pattern: new RegExp(String.raw`${START}secrets\.json${END}`, "i"), label: "secrets.json" },
  { pattern: new RegExp(String.raw`\.git[/\\]config${END}|${START}\.git-credentials${END}`, "i"), label: "git credentials" },
  { pattern: new RegExp(String.raw`\.claude[/\\]\.credentials\.json${END}`, "i"), label: "Claude credentials" },
];

// Keeps an agent with Claude Code's own tools away from the host's secret files.
export const secretsGuard: ToolPolicy = (call) => {
  const secret = targets(call).map(secretIn).find((label) => label !== null);

  return secret ? denied(call.name, secret) : { allow: true };
};

function targets(call: ToolPolicyCall): string[] {
  const input = (call.input ?? {}) as Record<string, unknown>;
  const fields = TARGET_FIELDS[call.name] ?? [];

  return fields.map((field) => input[field]).filter((value): value is string => typeof value === "string");
}

function secretIn(target: string): string | null {
  return SECRET_FILES.find((file) => file.pattern.test(target))?.label ?? null;
}

function denied(toolName: string, label: string): ToolPolicyDecision {
  return { allow: false, reason: `${toolName} was blocked: it targets a secret file (${label}).` };
}
