// Started from a Claude Code session (a local run), the child CLI inherited that session's variables, skipped its own
// login and talked to the session's endpoint (spike 2026-10-28). Of Claude Code's own variables only the OAuth token
// is passed on.
const PARENT_SESSION_VARIABLE = /^(CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_AGENT_SDK_.*|CLAUDE_EFFORT|CLAUDE_PID|CLAUDE_PREVIEW_.*|ANTHROPIC_BASE_URL)$/;
const TOKEN_VARIABLE = "CLAUDE_CODE_OAUTH_TOKEN";

export function childEnv(parentEnv: NodeJS.ProcessEnv, clientApp: string): Record<string, string | undefined> {
  const passedOn = Object.entries(parentEnv).filter(([name]) => isPassedOn(name));

  return { ...Object.fromEntries(passedOn), CLAUDE_AGENT_SDK_CLIENT_APP: clientApp };
}

function isPassedOn(name: string): boolean {
  return name === TOKEN_VARIABLE || !PARENT_SESSION_VARIABLE.test(name);
}
