using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// The tech-writer's merge tasks: one per vault draft (user decision 2026-10-02); a task whose draft is gone is done.
public static partial class DraftTasks
{
    public const string Assignee = "agent:tech-writer";

    private const string Prefix = "WT";
    private const int TitleMax = 120;
    private const string Actor = "drafts";
    private const string GoneResolution = "The draft is no longer in draft/ (merged or deleted outside the tech-writer).";

    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.Blocked];

    // The key names the draft as captured, so a later draft with the same name gets its own task. Null when the task exists.
    public static async Task<string?> CreateIfMissingAsync(PowerLoomDbContext db, string vault, NewDraftTask draft, CancellationToken cancellation)
    {
        var key = $"merge:{draft.Name}:{draft.Captured}";

        if (await db.LocalItems.FromSql($"select * from local_item where data->>'key' = {key}").AnyAsync(cancellation))
            return null;

        var id = await ItemIds.NextGlobalAsync(db, Prefix, cancellation);
        var title = $"Merge draft: {TitleOf(draft)}";

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Kind = ItemKind.Docs,
            PbiId = await PbiOfDraftAsync(db, draft.Name, cancellation),
            Vault = vault,
            Title = title[..Math.Min(title.Length, TitleMax)],
            Status = ItemStatus.Open,
            Assignee = Assignee,
            Body = draft.Name,
            Data = JsonSerializer.Serialize(new { key, draft = draft.Name, path = draft.Path, project = draft.Project, target = draft.Target, source = draft.Source, captured = draft.Captured }),
            HeldBy = "[]",
        });
        await db.SaveChangesAsync(cancellation);

        return id;
    }

    // Only draft tasks: the tech-writer's actualize tasks (from the vault review) have no draft.
    public static async Task<List<LocalItem>> WaitingAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        return await db.LocalItems.FromSql($"select * from local_item where kind = 'docs' and vault = {vault} and data->>'draft' is not null")
            .Where(task => Waiting.Contains(task.Status)).ToListAsync(cancellation);
    }

    public static string DraftNameOf(LocalItem task)
    {
        using var document = JsonDocument.Parse(task.Data ?? "{}");

        return document.RootElement.TryGetProperty("draft", out var name) && name.ValueKind == JsonValueKind.String ? name.GetString()! : task.Body ?? "";
    }

    // Merged or deleted outside the tech-writer (also by hand): nothing left to do. A running task is the runner's to end.
    public static async Task<int> CloseGoneAsync(PowerLoomDbContext db, IEnumerable<LocalItem> waiting, IReadOnlyDictionary<string, bool> stillDrafts, CancellationToken cancellation)
    {
        var gone = waiting.Where(task => stillDrafts.TryGetValue(DraftNameOf(task), out var isDraft) && !isDraft).ToList();

        foreach (var task in gone)
        {
            task.Resolution = GoneResolution;
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Done, Actor, null, cancellation);
        }

        return gone.Count;
    }

    // Draft notes often title themselves "Draft: …" or "… (draft)"; the task title says it already.
    private static string TitleOf(NewDraftTask draft)
    {
        var title = DraftSuffix().Replace(DraftPrefix().Replace(string.IsNullOrWhiteSpace(draft.Title) ? draft.Name : draft.Title, ""), "");

        return title.Length > 0 ? title : draft.Name;
    }

    // PowerLoom's drafts come from an agent run on a PBI (vault_capture); chat drafts have none.
    private static Task<int?> PbiOfDraftAsync(PowerLoomDbContext db, string name, CancellationToken cancellation)
    {
        return db.VaultCaptures.AsNoTracking().Where(capture => capture.Name == name).OrderByDescending(capture => capture.Id).Select(capture => (int?)capture.PbiId).FirstOrDefaultAsync(cancellation);
    }

    [GeneratedRegex(@"^draft:\s*", RegexOptions.IgnoreCase)]
    private static partial Regex DraftPrefix();

    [GeneratedRegex(@"\s*\(draft\)$", RegexOptions.IgnoreCase)]
    private static partial Regex DraftSuffix();
}
