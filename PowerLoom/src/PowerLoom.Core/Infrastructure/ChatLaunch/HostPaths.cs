using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Infrastructure.ChatLaunch;

// Paths on the user's PC: the chat runs there, not in the containers.
public sealed class HostPaths(IOptions<ChatOptions> chat, IOptions<VaultOptions> vaults)
{
    // The chat opens in exactly the vault's folder (user decision 2026-10-05), so that vault's own rules load.
    public string ChatFolder(string vault) => $"{Trim(vaults.Value.HostRoot)}/{vault}";

    // A note of a vault's backlog, read by absolute path (user decision 2026-10-07: the backlog isn't added to the session).
    public string BacklogPath(string vault, string backlogRelativePath) => $"{Trim(chat.Value.BacklogHostRoot)}/{vault}/{backlogRelativePath}";

    public IReadOnlyList<string> RepoPaths(IEnumerable<string> repoNames) => repoNames.Select(name => $"{Trim(chat.Value.ReposRoot)}/{name}").ToList();

    // A project folder of a vault, which is a folder of the vaults root.
    public string DocsProjectFolder(string vault, string project) => $"{ChatFolder(vault)}/{project}";

    public string? AgentTools => string.IsNullOrWhiteSpace(chat.Value.AgentTools) ? null : Trim(chat.Value.AgentTools);

    private static string Trim(string path) => path.Replace('\\', '/').TrimEnd('/');
}
