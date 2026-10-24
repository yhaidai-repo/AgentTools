using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Features.Continue;

// One flow for every kind: the launcher, the kind's brief, the chat note written into the vault's backlog, the link.
public sealed class ChatOpener(IEnumerable<IChatTarget> targets, ChatLaunchers launchers, BacklogFiles backlog, HostPaths hostPaths, TimeProvider clock)
{
    public async Task<Outcome<ChatLink>> OpenAsync(ChatKind kind, string id, CancellationToken cancellation)
    {
        var launcher = launchers.Current();

        if (!launcher.Ok)
            return Outcome<ChatLink>.Failure(launcher.Problem);

        var target = targets.Single(target => target.Kind == kind);
        var brief = await target.BriefAsync(id, launcher.Value, cancellation);

        if (!brief.Ok)
            return Outcome<ChatLink>.Failure(brief.Problem);

        var handoff = await WriteNoteAsync(brief.Value, kind, id, launcher.Value.Label, cancellation);
        var launch = launcher.Value.Open(RequestFor(brief.Value, handoff));

        if (!launch.Ok)
            return Outcome<ChatLink>.Failure(launch.Problem);

        await target.OpenedAsync(id, cancellation);

        return Outcome<ChatLink>.Success(new ChatLink(launch.Value.Url));
    }

    private async Task<ChatHandoff> WriteNoteAsync(ChatBrief brief, ChatKind kind, string id, string label, CancellationToken cancellation)
    {
        var notePath = BacklogPaths.ChatNotePath(ChatNote.KindLabel(kind), id);
        var existing = await backlog.ReadTextAsync(brief.Vault, notePath, cancellation);
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
