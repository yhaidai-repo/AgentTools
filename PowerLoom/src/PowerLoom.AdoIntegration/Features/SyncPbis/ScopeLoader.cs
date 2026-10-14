using System.Text.Json;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Pbis;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Scope = the user's Tasks in one sprint, in any state (user decision 2026-10-09): their parents are the PBIs to pull,
// whoever owns them and whatever their state, and the [BUG] Tasks among them are the bugs. Null when the sprint can't
// be found.
public static class ScopeLoader
{
    private static readonly string[] TaskFields = [AdoFields.Type, AdoFields.Title, AdoFields.Parent, AdoFields.State, AdoFields.Effort];

    public static async Task<SyncScope?> LoadAsync(IAdoClient client, AdoSettings ado, SyncSettings sync, CancellationToken cancellation)
    {
        var iteration = await SprintResolver.ResolveAsync(client, sync.Sprint, cancellation);

        if (iteration is null)
            return null;

        var taskIds = await client.QueryIdsAsync(Wiql.SprintTasks(ado.Project, iteration.Path, ado.User), cancellation);
        var tasks = await client.GetWorkItemsAsync(taskIds, TaskFields, cancellation);
        var parents = tasks.Select(ParentOf).Where(parent => parent is not null).Select(parent => parent!.Value).Distinct().Order().ToList();
        var bugs = tasks.Where(task => BugRule.IsMarkedBug(Text(task, AdoFields.Type), Text(task, AdoFields.Title))).Select(task => task.Id).ToList();

        return new SyncScope(parents, bugs, iteration, ChildTaskEffort.SumByParent(tasks));
    }

    private static int? ParentOf(AdoWorkItem task)
    {
        return task.Fields.TryGetValue(AdoFields.Parent, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetInt32() : null;
    }

    private static string Text(AdoWorkItem task, string key) => task.Fields.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";
}
