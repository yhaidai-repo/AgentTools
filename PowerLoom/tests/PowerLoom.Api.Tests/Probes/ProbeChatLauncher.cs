using PowerLoom.Contracts;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Api.Tests.Probes;

// A second chat app, so a test can choose another app than Claude and see the buttons and links follow.
public sealed class ProbeChatLauncher : IChatLauncher
{
    public const string LauncherId = "probe-app";

    public string Id => LauncherId;

    public string Label => "Probe App";

    public Outcome<OpenedChat> Open(ChatRequest request) => Outcome<OpenedChat>.Success(new OpenedChat($"probe://chat?folder={Uri.EscapeDataString(request.Folder)}"));

    public IReadOnlyList<string> VaultSetupSteps(string vaultFolder, string agentTools) => [$"Set up {vaultFolder} for the probe app."];
}
