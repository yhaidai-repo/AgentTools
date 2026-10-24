using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// Linked documents agents can't open become human tasks (user decision 2026-10-01): the user attaches the content, or
// cancels the task when agents don't need it. Like every human task, it blocks the agents while open.
public static class DocumentTasks
{
    private const string Actor = "worker";

    // URLs already handled: content uploaded, or a task asked for (in any status, so a cancelled one isn't asked again).
    public static async Task<HashSet<string>> HandledUrlsAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var uploaded = await db.Attachments.AsNoTracking().Where(row => row.PbiId == adoId && row.SourceUrl != null).Select(row => row.SourceUrl!).ToListAsync(cancellation);
        var asked = await db.LocalItems.FromSql($"select * from local_item where pbi_id = {adoId} and kind = 'human' and data->>'url' is not null").Select(item => item.Data!).ToListAsync(cancellation);

        return uploaded.Concat(asked.Select(UrlOf).Where(url => url is not null).Select(url => url!)).Select(LinkedDocuments.DocumentUrl).ToHashSet();
    }

    // Null when a task for this document already exists (any status).
    public static async Task<string?> CreateAsync(PowerLoomDbContext db, int adoId, string url, string? problem, CancellationToken cancellation)
    {
        if (await ItemKeys.HasItemWithKeyAsync(db, adoId, ItemKeys.DocumentKey(url), cancellation))
            return null;

        var label = LinkedDocuments.Label(LinkedDocuments.KindOf(url));
        var why = problem is null ? "Agents can't open it (no access to Confluence or the web)." : $"PowerLoom couldn't fetch it: {problem}";
        var body = $"The PBI links {url}\n\n{why}\n\nUpload it here (PDF, Word, saved HTML or text). Cancel the task if the agents don't need it.";
        var data = JsonSerializer.Serialize(new { url, key = ItemKeys.DocumentKey(url) });

        return await HumanTasks.CreateAsync(db, new NewHumanTask(adoId, $"Attach the content of the linked {label}", body, null, data), cancellation);
    }

    // The content arrived after all (e.g. a Confluence page fetched once the credentials were set): the open task
    // asking for it is done, with how it was resolved.
    public static async Task ResolveAsync(PowerLoomDbContext db, int adoId, string url, string resolution, CancellationToken cancellation)
    {
        var key = ItemKeys.DocumentKey(url);
        var open = await db.LocalItems.FromSql($"select * from local_item where pbi_id = {adoId} and kind = 'human' and data->>'key' = {key}").Where(item => item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress).ToListAsync(cancellation);

        foreach (var task in open)
        {
            task.Resolution = resolution;
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Done, Actor, null, cancellation);
        }
    }

    private static string? UrlOf(string data)
    {
        using var document = JsonDocument.Parse(data);

        return document.RootElement.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String ? url.GetString() : null;
    }
}
