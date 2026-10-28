using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;

namespace PowerLoom.Features.Continue;

public sealed class ChatConversations(IEnumerable<IChatTarget> targets, ChatLaunchers launchers, DesktopConversationCatalog catalog, HostPaths paths)
{
    public async Task<Outcome<ChatConversationChoices>> ChoicesAsync(ChatKind kind, string id, string? search, CancellationToken cancellation)
    {
        if (kind is ChatKind.Vault or ChatKind.Import || string.IsNullOrWhiteSpace(id) || search?.Length > 200)
            return Outcome<ChatConversationChoices>.Failure(Problem.Invalid("Choose a PBI, item or review and a search of at most 200 characters."));

        var launcher = await launchers.CurrentAsync(cancellation);

        if (!launcher.Ok)
            return Outcome<ChatConversationChoices>.Failure(launcher.Problem);

        var target = targets.SingleOrDefault(target => target.Kind == kind);

        if (target is null)
            return Outcome<ChatConversationChoices>.Failure(Problem.Invalid("Unknown chat target."));

        var brief = await target.BriefAsync(id, launcher.Value, cancellation);

        if (!brief.Ok)
            return Outcome<ChatConversationChoices>.Failure(brief.Problem);

        var chats = await catalog.ReadAsync(launcher.Value.Id, cancellation);

        if (!chats.Ok)
            return Outcome<ChatConversationChoices>.Failure(chats.Problem);

        var folders = paths.RepoPaths(brief.Value.Repos).Prepend(paths.ChatFolder(brief.Value.Vault)).ToList();
        var query = search?.Trim() ?? "";
        var choices = chats.Value.Where(chat => query.Length == 0 || chat.Title.Contains(query, StringComparison.OrdinalIgnoreCase) || chat.Folder.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Select(chat => chat with { IsRelated = folders.Any(folder => Related(chat.Folder, folder)) })
            .OrderByDescending(chat => chat.IsRelated).ThenByDescending(chat => chat.UpdatedAt).Take(100).ToList();

        return Outcome<ChatConversationChoices>.Success(new ChatConversationChoices(launcher.Value.Id, launcher.Value.Label, choices));
    }

    private static bool Related(string candidate, string folder)
    {
        var normalized = candidate.Replace('\\', '/').TrimEnd('/');
        var root = folder.Replace('\\', '/').TrimEnd('/');

        return normalized.Equals(root, StringComparison.OrdinalIgnoreCase) || normalized.StartsWith(root + "/", StringComparison.OrdinalIgnoreCase);
    }
}
