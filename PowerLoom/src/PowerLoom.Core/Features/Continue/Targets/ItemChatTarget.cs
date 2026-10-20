using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Continue.Targets;

// A chat on a question, human task or finding: the item's note and its PBI's notes; a finding without a PBI brings
// its text and its project's registers (user decision 2026-10-05). An agent task too (user decision 2026-10-16).
public sealed class ItemChatTarget(PowerLoomDbContext db, HostPaths hostPaths, PbiRepos pbiRepos) : IChatTarget
{
    public ChatKind Kind => ChatKind.Item;

    public async Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation)
    {
        var item = await db.LocalItems.AsNoTracking().SingleOrDefaultAsync(row => row.Id == id, cancellation);
        var outline = item is null ? null : ItemChats.For(item);

        if (item is null || outline is null)
            return Outcome<ChatBrief>.Failure(item is null ? Problem.NotFound($"{id} not found.") : Problem.Invalid($"No chat for a {item.Kind}."));

        var brief = ChatBrief.For(item.Vault, $"{outline.Opening} {item.Id}: {item.Title}") with
        {
            Briefing = outline.Briefing,
            Ending = outline.Ending,
            Rules = [outline.Rule],
            Sections = [new ChatSection("The item", ItemMarkdown(item)), new ChatSection(ItemChatEndings.Heading, ItemChatEndings.Markdown(item))],
        };

        return Outcome<ChatBrief>.Success(item.PbiId is { } adoId ? await WithPbiAsync(brief, item, adoId, cancellation) : WithProject(brief, item));
    }

    // An item under a PBI: its note and the PBI's notes, with the PBI's repos.
    private async Task<ChatBrief> WithPbiAsync(ChatBrief brief, LocalItem item, int adoId, CancellationToken cancellation)
    {
        var pbiPath = await db.WorkItems.Where(row => row.AdoId == adoId).Select(row => row.VaultPath).SingleOrDefaultAsync(cancellation);
        var readFirst = new List<ReadFirstLink>();

        if (item.VaultPath is not null)
            readFirst.Add(new ReadFirstLink(item.Id, hostPaths.BacklogPath(item.Vault, item.VaultPath), "the item"));

        if (pbiPath is not null)
            readFirst.Add(new ReadFirstLink(BacklogPaths.PbiNoteName(adoId), hostPaths.BacklogPath(item.Vault, BacklogPaths.FolderOf(pbiPath)), "the PBI's folder: its note, the refinement, the design when present, research/"));

        return brief with { Pbis = [adoId], ReadFirst = readFirst, Repos = await pbiRepos.NamesAsync(adoId, cancellation) };
    }

    // A finding without a PBI (e.g. from a tech-writer task): its project's index names the repo, its registers say
    // what is recorded already.
    private ChatBrief WithProject(ChatBrief brief, LocalItem item)
    {
        var project = FindingData.Parse(item.Data)?.Project;

        if (string.IsNullOrWhiteSpace(project))
            return brief;

        var folder = hostPaths.DocsProjectFolder(item.Vault, project);

        return brief with
        {
            Before =
            [
                $"Add the repo named by the `repo:` line of {folder}/{project}-index.md to this session.",
                $"Read the registers {folder}/{project}-open-questions.md and {folder}/{project}-known-issues.md, and the code the finding cites.",
            ],
        };
    }

    private static string ItemMarkdown(LocalItem item)
    {
        var data = FindingData.Parse(item.Data);
        var parts = new List<string> { item.Body ?? "(no text)" };

        if (data is not null)
            parts.Add($"Register: {(data.Type == "issue" ? "known issues" : "open questions")}, project {data.Project}.");

        if (data?.Default is { Length: > 0 } defaults)
            parts.Add($"Default: {string.Join("; ", defaults)}");

        if (data?.Options is { Length: > 0 } options)
            parts.Add($"Options: {string.Join("; ", options)}");

        // An agent task without a PBI keeps its result here; a PBI task's results are in the PBI's notes.
        if (!string.IsNullOrWhiteSpace(item.Resolution))
            parts.Add($"Result:\n\n{item.Resolution}");

        return string.Join("\n\n", parts);
    }
}
