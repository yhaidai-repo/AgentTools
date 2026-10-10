using System.Text.Json;
using PowerLoom.Domain.Repos;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Tasks.Schedules;

// Any agent can be scheduled with a goal on the vault's repositories (user decision 2026-10-06); agents with a task
// producer (the vault review) make their own tasks instead.
public sealed record GoalParams(string Goal, IReadOnlyList<string> Repos)
{
    private const int GoalMax = 4_000;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static GoalParams Of(string paramsJson)
    {
        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(paramsJson) ? "{}" : paramsJson);
        var root = document.RootElement;
        var goal = root.TryGetProperty("goal", out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()!.Trim() : "";
        var repos = root.TryGetProperty("repos", out var list) && list.ValueKind == JsonValueKind.Array ? list.EnumerateArray().Select(item => item.ToString()).ToList() : [];

        return new GoalParams(goal, repos);
    }

    public string ToJson() => JsonSerializer.Serialize(new { goal = Goal, repos = Repos }, Json);

    public async Task<string?> ProblemAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        if (Goal.Length == 0)
            return "A scheduled task needs a goal.";

        if (Goal.Length > GoalMax)
            return $"The goal is too long ({Goal.Length} of {GoalMax} characters).";

        var offered = (await RepoCatalog.EnabledAsync(db, vault, cancellation)).Select(repo => repo.Name).ToHashSet();
        var unknown = Repos.Where(name => !offered.Contains(name)).ToList();

        return unknown.Count > 0 ? $"Not among the vault's enabled repositories: {string.Join(", ", unknown)}." : null;
    }
}
