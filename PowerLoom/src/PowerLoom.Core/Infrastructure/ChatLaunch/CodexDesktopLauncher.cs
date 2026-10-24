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

        return Outcome<OpenedChat>.Success(new OpenedChat($"codex://new?path={Uri.EscapeDataString(request.Folder)}&prompt={Uri.EscapeDataString(prompt)}"));
    }

    public IReadOnlyList<string> VaultSetupSteps(string vaultFolder, string agentTools)
    {
        return
        [
            $"Make sure ~/.codex/hooks.json has these two hooks, adding only what is missing: a PostToolUse hook with matcher \".*\" running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultUsage/Adapters/Codex/Invoke-CodexHook.ps1\", and a Stop hook running pwsh -NoProfile -NonInteractive -File \"{agentTools}/VaultCapture/Adapters/Codex/Invoke-ContextLimitHook.ps1\". Review and trust the hooks in /hooks.",
            $"Trust the project {vaultFolder} so its .codex/config.toml loads. Allow the \"powerloom\" MCP server listed there, then call its status_get tool once; an answer with PowerLoom's state means the vault's chats reach PowerLoom.",
        ];
    }
}
