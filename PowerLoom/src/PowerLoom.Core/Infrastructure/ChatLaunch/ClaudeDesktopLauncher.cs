using PowerLoom.Contracts;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Infrastructure.ChatLaunch;

// Claude desktop's Code tab. Its link takes one folder and a prompt only, so the prompt asks the chat to add the other
// folders itself.
public sealed class ClaudeDesktopLauncher : IChatLauncher
{
    public const string LauncherId = "claude-desktop";

    // The claude:// link cuts the prompt at about 14,000 characters (Claude docs, 2026-10-05).
    private const int PromptMax = 14_000;

    public string Id => LauncherId;

    public string Label => "Claude";

    public Outcome<OpenedChat> Open(ChatRequest request)
    {
        var prompt = ChatPrompt.Build(request, "Add these folders to this session", PromptMax);

        if (prompt.Length > PromptMax)
            return Outcome<OpenedChat>.Failure(Problem.Invalid($"The prompt has {prompt.Length} characters; a claude:// link takes about {PromptMax}."));

        return Outcome<OpenedChat>.Success(new OpenedChat($"claude://code/new?folder={Uri.EscapeDataString(request.Folder)}&q={Uri.EscapeDataString(prompt)}"));
    }

    // Claude Code learns vaults through two hooks (VaultUsage logs note reads, VaultCapture saves drafts before the
    // context is compacted); both find a vault by its .obsidian folder, so no vault list is kept (2026-10-06).
    // CLAUDE.md is Claude's entry to the vault's rules, so it is Claude's to create.
    public IReadOnlyList<string> VaultSetupSteps(string vaultFolder, string agentTools)
    {
        return
        [
            $"Create {vaultFolder}/CLAUDE.md unless it exists, with exactly: \"# Docs vault\", an empty line, \"Follow @AGENTS.md for every change in this folder. Be short.\"",
            $"Make sure ~/.claude/settings.json has these two hooks, adding only what is missing: a PostToolUse hook with matcher \"Read|Edit|MultiEdit|Write|Grep|Bash|PowerShell\" running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultUsage/Adapters/ClaudeCode/Invoke-ClaudeHook.ps1\", and a Stop hook running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultCapture/Adapters/ClaudeCode/Invoke-ContextLimitHook.ps1\".",
            $"Claude Code asks whether to use the \"powerloom\" MCP server that {vaultFolder}/.mcp.json lists (PowerLoom writes that entry): allow it, then call its status_get tool once; an answer with PowerLoom's state means the vault's chats reach PowerLoom.",
        ];
    }

}
