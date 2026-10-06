import type { ChatLauncher } from "../../models/ChatLauncher";
import type { ChatRequest } from "../../models/ChatRequest";

// The claude:// link cuts the prompt at about 14,000 characters (Claude docs, 2026-10-05).
const PROMPT_MAX = 14_000;

// Claude desktop's Code tab. Its link takes one folder and a prompt only, so the prompt asks the chat to add the other
// folders itself.
export const claudeDesktopLauncher: ChatLauncher = {
  id: "claude-desktop",
  label: "Claude",
  open(request) {
    const prompt = claudePrompt(request);

    if (prompt.length > PROMPT_MAX) {
      return { ok: false, error: `The prompt has ${prompt.length} characters; a claude:// link takes about ${PROMPT_MAX}.` };
    }

    return { ok: true, value: { url: `claude://code/new?folder=${encodeURIComponent(request.folder)}&q=${encodeURIComponent(prompt)}` } };
  },
  // Claude Code learns vaults through two hooks (VaultUsage logs note reads, VaultCapture saves drafts before the context
  // is compacted); both find a vault by its .obsidian folder, so no vault list is kept (2026-10-06). CLAUDE.md is Claude's
  // entry to the vault's rules, so it is Claude's to create.
  vaultSetupSteps({ vaultFolder, agentTools }) {
    return [
      `Create ${vaultFolder}/CLAUDE.md unless it exists, with exactly: "# Docs vault", an empty line, "Follow @AGENTS.md for every change in this folder. Be short."`,
      `Make sure ~/.claude/settings.json has these two hooks, adding only what is missing: a PostToolUse hook with matcher "Read|Edit|MultiEdit|Write|Grep|Bash|PowerShell" running pwsh -NoProfile -NonInteractive -File "${agentTools}/VaultUsage/Adapters/ClaudeCode/Invoke-ClaudeHook.ps1", and a Stop hook running pwsh -NoProfile -NonInteractive -File "${agentTools}/VaultCapture/Adapters/ClaudeCode/Invoke-ContextLimitHook.ps1".`,
    ];
  },
};

function claudePrompt(request: ChatRequest): string {
  const addFolders = request.extraFolders.length > 0 ? [`Add these folders to this session: ${request.extraFolders.join(", ")}.`] : [];
  const steps = [...addFolders, ...request.steps].map((step, index) => `${index + 1}. ${step}`);

  return [request.title, ...request.intro, ...steps].join("\n");
}
