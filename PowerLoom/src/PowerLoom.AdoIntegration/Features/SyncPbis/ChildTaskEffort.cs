using System.Text.Json;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// The team enters Effort on a PBI's child Tasks, not on the PBI, and the dashboard counts only the user's own
// (user decision 2026-10-14): an item's sprint effort is the sum over the user's Tasks under it in that sprint, the
// Tasks the sync's scope already reads. Removed Tasks don't count.
public static class ChildTaskEffort
{
    private const string RemovedState = "Removed";

    // Parent id → the sum of its Tasks' Effort; a parent whose Tasks carry no Effort is left out.
    public static IReadOnlyDictionary<int, decimal> SumByParent(IReadOnlyList<AdoWorkItem> tasks)
    {
        return tasks
            .Where(IsCounted)
            .GroupBy(task => (int)Number(task, AdoFields.Parent)!.Value)
            .ToDictionary(group => group.Key, group => group.Sum(task => Number(task, AdoFields.Effort)!.Value));
    }

    private static bool IsCounted(AdoWorkItem task)
    {
        var hasParentAndEffort = Number(task, AdoFields.Parent) is not null && Number(task, AdoFields.Effort) is not null;

        return hasParentAndEffort && State(task) != RemovedState;
    }

    private static decimal? Number(AdoWorkItem task, string key)
    {
        return task.Fields.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDecimal() : null;
    }

    private static string State(AdoWorkItem task)
    {
        return task.Fields.TryGetValue(AdoFields.State, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";
    }
}
