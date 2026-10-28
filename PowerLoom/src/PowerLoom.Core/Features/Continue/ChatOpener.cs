using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Features.Continue;

// One flow for every kind: the launcher, the kind's brief, the chat note written into the vault's backlog, the link.
public sealed class ChatOpener(IEnumerable<IChatTarget> targets, ChatLaunchers launchers, BacklogFiles backlog, HostPaths hostPaths, TimeProvider clock, DesktopConversationCatalog catalog)
{
    public async Task<Outcome<ChatLink>> OpenAsync(OpenChatRequest request, CancellationToken cancellation)
    {
        var (kind, id) = (request.Kind, request.Id);
        var launcher = await launchers.CurrentAsync(cancellation);

        if (!launcher.Ok)
            return Outcome<ChatLink>.Failure(launcher.Problem);

        if (request.Destination is { } destination)
        {
            if (kind is ChatKind.Vault or ChatKind.Import)
                return Outcome<ChatLink>.Failure(Problem.Invalid("Vault configuration and folder import start in a new chat."));

            if (destination.Launcher != launcher.Value.Id)
                return Outcome<ChatLink>.Failure(Problem.Conflict("The chat app changed. Reload the conversation list and choose again."));

            var choices = await catalog.ReadAsync(launcher.Value.Id, cancellation);

            if (!choices.Ok)
                return Outcome<ChatLink>.Failure(choices.Problem);

            if (!choices.Value.Any(chat => chat.Id == destination.ConversationId))
                return Outcome<ChatLink>.Failure(Problem.NotFound("That conversation is no longer available. Reload the list and choose again."));
        }

        var target = targets.SingleOrDefault(target => target.Kind == kind);

        if (target is null || string.IsNullOrWhiteSpace(id))
            return Outcome<ChatLink>.Failure(Problem.Invalid("Choose a valid chat target."));
        var brief = await target.BriefAsync(request, launcher.Value, cancellation);

        if (!brief.Ok)
            return Outcome<ChatLink>.Failure(brief.Problem);

        var handoff = await HandoffAsync(brief.Value, kind, id, launcher.Value.Label, request.Destination is not null, cancellation);
        var launch = launcher.Value.Open(RequestFor(brief.Value, handoff) with { Destination = request.Destination });

        if (!launch.Ok)
            return Outcome<ChatLink>.Failure(launch.Problem);

        await target.OpenedAsync(id, cancellation);

        return Outcome<ChatLink>.Success(new ChatLink(launch.Value.Url, launch.Value.ClipboardText));
    }

    private async Task<ChatHandoff> HandoffAsync(ChatBrief brief, ChatKind kind, string id, string label, bool existingChat, CancellationToken cancellation)
    {
        var notePath = BacklogPaths.ChatNotePath(ChatNote.KindLabel(kind), id);
        var existing = await backlog.ReadTextAsync(brief.Vault, notePath, cancellation);

        // The item owns this note. Choosing another conversation must not rewrite it; create it once if missing.
        if (existingChat && existing is not null)
            return new ChatHandoff(hostPaths.BacklogPath(brief.Vault, notePath), ChatNote.ShortVersion(existing));

        var text = ChatNote.Render(brief, kind, id, label, ChatNote.NotesSectionOf(existing), DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));

        await backlog.WriteTextAsync(brief.Vault, notePath, text, cancellation);

        return new ChatHandoff(hostPaths.BacklogPath(brief.Vault, notePath), ChatNote.ShortVersion(text));
    }

    // One prompt for every kind: the folders to add and the note, which holds the rest.
    private ChatRequest RequestFor(ChatBrief brief, ChatHandoff handoff)
    {
        var folders = hostPaths.RepoPaths(brief.Repos).Concat(brief.ExtraFolders).ToList();

        return new ChatRequest(brief.Title, [], hostPaths.ChatFolder(brief.Vault), folders, [], handoff);
    }
}
