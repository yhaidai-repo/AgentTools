using PowerLoom.Contracts;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Infrastructure.ChatLaunch;

public sealed class CodexDesktopLauncher : IChatLauncher
{
    public const string LauncherId = "codex-desktop";

    // Codex documents no prompt length limit; use the same conservative limit as the Claude launcher.
    private const int PromptMax = 14_000;

    public string Id => LauncherId;

    public string Label => "Codex";

    public Outcome<OpenedChat> Open(ChatRequest request)
    {
        var prompt = ChatPrompt.Build(request, "Work in these folders too (absolute paths)", PromptMax);

        if (prompt.Length > PromptMax)
            return Outcome<OpenedChat>.Failure(Problem.Invalid($"The prompt has {prompt.Length} characters; the codex:// link limit used here is {PromptMax}."));

        if (request.Destination is { } destination)
        {
            if (destination.Launcher != Id || !Guid.TryParseExact(destination.ConversationId, "D", out _))
                return Outcome<OpenedChat>.Failure(Problem.Invalid("Choose an existing Codex conversation from the list."));

            return Outcome<OpenedChat>.Success(new OpenedChat($"codex://threads/{Uri.EscapeDataString(destination.ConversationId)}?prompt={Uri.EscapeDataString(prompt)}"));
        }

        return Outcome<OpenedChat>.Success(new OpenedChat($"codex://new?path={Uri.EscapeDataString(request.Folder)}&prompt={Uri.EscapeDataString(prompt)}"));
    }

    // The skills PowerLoom's own chat notes name; a PBI chat also names the PBI's skills, which come from the same folder.
    private static readonly string[] HandoffSkills = ["create-branch", "www-record"];

    // Codex reads neither ~/.claude/CLAUDE.md nor ~/.claude/skills: the owner's global rules and skills are copied where
    // Codex looks (~/.codex/AGENTS.md, ~/.agents/skills), so Codex chats work like Claude Code's.
    public IReadOnlyList<string> VaultSetupSteps(string vaultFolder, string agentTools)
    {
        return
        [
            "Copy my global rules ~/.claude/CLAUDE.md into ~/.codex/AGENTS.md: create the file with its text if it doesn't exist; if it exists and doesn't hold these rules yet, show me the difference and ask before adding them at the end under the heading \"# Rules from Claude Code\". Never remove what is already there.",
            $"Make my skills available to Codex: copy each skill folder of ~/.claude/skills into ~/.agents/skills (PowerLoom's chat notes name {string.Join(" and ", HandoffSkills)}; a PBI chat also names the PBI's skills). Skip a skill that is already there with the same files; ask me before overwriting one that differs. Then list what was copied, skipped and left as it was.",
            $"Make sure ~/.codex/hooks.json has these two hooks, adding only what is missing: a PostToolUse hook with matcher \".*\" running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultUsage/Adapters/Codex/Invoke-CodexHook.ps1\", and a Stop hook running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultCapture/Adapters/Codex/Invoke-ContextLimitHook.ps1\". Review and trust the hooks in /hooks.",
            $"Trust the project {vaultFolder} so its .codex/config.toml loads. Allow the \"powerloom\" MCP server listed there, then call its status_get tool once; an answer with PowerLoom's state means the vault's chats reach PowerLoom.",
        ];
    }
}
