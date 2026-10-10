using PowerLoom.Contracts;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Infrastructure.ChatLaunch;

// One agent app a chat can be continued in (model agnostic, user decision 2026-10-05). A new app or model is a new
// launcher; the targets (PBI, item, review, vault) don't change.
public interface IChatLauncher
{
    string Id { get; }

    // The button says "Continue with <label>".
    string Label { get; }

    Outcome<OpenedChat> Open(ChatRequest request);

    // What a chat must set up on the PC so this app works with a new vault (user decision 2026-10-06), as prompt steps.
    IReadOnlyList<string> VaultSetupSteps(string vaultFolder, string agentTools);
}
