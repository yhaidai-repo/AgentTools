using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// The anchor an access request leaves on an agent task (`data.rerunAfter`, written by the agent-runner when a tool was
// refused for access; user decisions 2026-10-13): the task waits while the human task is open, runs again when it is
// done, and forgets it when it is cancelled.
public static class AccessAnchors
{
    private const string RerunAfter = "rerunAfter";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // The access tasks the agent task still waits for: the anchored ids that are open.
    public static async Task<List<string>> OpenAnchorsAsync(PowerLoomDbContext db, LocalItem task, CancellationToken cancellation)
    {
        var anchors = AnchorsOf(task.Data);

        if (anchors.Count == 0)
            return [];

        return await db.LocalItems.AsNoTracking()
            .Where(item => anchors.Contains(item.Id) && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress))
            .OrderBy(item => item.Id).Select(item => item.Id).ToListAsync(cancellation);
    }

    // After a human task closed: done → every finished agent task anchored to it runs again; cancelled → the anchor goes.
    public static async Task<List<string>> AfterCloseAsync(PowerLoomDbContext db, LocalItem closed, ItemStatus status, CancellationToken cancellation)
    {
        if (closed.Kind != ItemKinds.Human)
            return [];

        var anchored = await AnchoredTasksAsync(db, closed.Id, cancellation);

        return status == ItemStatus.Done ? await RerunAsync(db, anchored, cancellation) : await ForgetAsync(db, anchored, closed.Id, cancellation);
    }

    private static Task<List<LocalItem>> AnchoredTasksAsync(PowerLoomDbContext db, string humanTaskId, CancellationToken cancellation)
    {
        return db.LocalItems
            .FromSql($"select * from local_item where exists (select 1 from jsonb_array_elements_text(data->'rerunAfter') anchor where anchor = {humanTaskId})")
            .ToListAsync(cancellation);
    }

    private static async Task<List<string>> RerunAsync(PowerLoomDbContext db, List<LocalItem> anchored, CancellationToken cancellation)
    {
        var reopened = new List<string>();

        foreach (var task in anchored.Where(TaskRerun.IsRerunnable))
        {
            var result = await TaskRerun.RerunAsync(db, task.PbiId, task.Id, startOver: false, cancellation);

            if (result.Ok)
                reopened.Add(result.Value!);
        }

        return reopened;
    }

    private static async Task<List<string>> ForgetAsync(PowerLoomDbContext db, List<LocalItem> anchored, string humanTaskId, CancellationToken cancellation)
    {
        foreach (var task in anchored)
            task.Data = WithoutAnchor(task.Data, humanTaskId);

        await db.SaveChangesAsync(cancellation);

        return [];
    }

    private static List<string> AnchorsOf(string? data) => ItemData.StringsOf(data, RerunAfter);

    private static string WithoutAnchor(string? data, string humanTaskId)
    {
        var node = JsonNode.Parse(data ?? "{}")?.AsObject() ?? new JsonObject();
        var kept = AnchorsOf(data).Where(anchor => anchor != humanTaskId).ToList();

        node[RerunAfter] = JsonSerializer.SerializeToNode(kept, Json);

        return node.ToJsonString(Json);
    }
}
