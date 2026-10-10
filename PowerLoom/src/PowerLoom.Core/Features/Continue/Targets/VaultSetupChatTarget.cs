using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Features.Continue.Targets;

// "Configure with <agent>" after a vault was added (user decision 2026-10-06): the chat runs on the PC and adds what
// its app needs there. The launcher says what.
public sealed class VaultSetupChatTarget(PowerLoomDbContext db, HostPaths hostPaths) : IChatTarget
{
    public ChatKind Kind => ChatKind.Vault;

    public async Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(id, cancellation))
            return Outcome<ChatBrief>.Failure(Problem.NotFound($"{id} isn't a vault."));

        if (hostPaths.AgentTools is null)
            return Outcome<ChatBrief>.Failure(Problem.Invalid("Set AGENTTOOLS_PATH in .env: the folder with VaultUsage and VaultCapture on the PC."));

        var folder = hostPaths.ChatFolder(id);
        var steps = launcher.VaultSetupSteps(folder, hostPaths.AgentTools)
            .Append($"Check that {folder} has an .obsidian folder (open it in Obsidian once if not): the tools recognise a vault by it.")
            .Select((step, index) => $"{index + 1}. {step}");

        return Outcome<ChatBrief>.Success(ChatBrief.For(id, $"Configure the vault {id} for {launcher.Label}") with
        {
            Ending = $"Do the Setup steps below. Then read {folder}/AGENTS.md and tell me in a few lines what you changed on this PC and what the vault's rules ask of you.",
            Sections = [new ChatSection("Setup", $"The vault's folder is {folder}; adoa's tools (VaultUsage, VaultCapture) are in {hostPaths.AgentTools}.\n\n{string.Join("\n", steps)}")],
            ExtraFolders = [hostPaths.AgentTools],
        });
    }
}
