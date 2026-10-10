namespace PowerLoom.AdoIntegration.Client;

// The sync's queries: one sprint at a time; empty states or user means no filter on that field.
public static class Wiql
{
    private const string PbiTypes = "('Product Backlog Item', 'Bug')";

    public static string SprintScope(string project, string iterationPath, IReadOnlyList<string> states, string user)
    {
        var conditions = new List<string>
        {
            $"[System.TeamProject] = {Quote(project)}",
            $"[System.WorkItemType] IN {PbiTypes}",
            $"[System.IterationPath] = {Quote(iterationPath)}",
        };

        if (states.Count > 0)
            conditions.Add($"[System.State] IN ({string.Join(", ", states.Select(Quote))})");

        conditions.AddRange(UserCondition(user));

        return Query(conditions);
    }

    // The sync's scope (user decision 2026-10-09): the sprint's Tasks assigned to the user, in any state; their parents
    // are the PBIs the sync pulls. Empty user means anyone's.
    public static string SprintTasks(string project, string iterationPath, string user)
    {
        var conditions = new List<string>
        {
            $"[System.TeamProject] = {Quote(project)}",
            "[System.WorkItemType] = 'Task'",
            $"[System.IterationPath] = {Quote(iterationPath)}",
        };

        conditions.AddRange(UserCondition(user));

        return Query(conditions);
    }

    private static IEnumerable<string> UserCondition(string user) => string.IsNullOrEmpty(user) ? [] : [$"[System.AssignedTo] = {Quote(user)}"];

    private static string Query(IEnumerable<string> conditions) => $"SELECT [System.Id] FROM WorkItems WHERE {string.Join(" AND ", conditions)}";

    private static string Quote(string value) => $"'{value.Replace("'", "''")}'";
}
