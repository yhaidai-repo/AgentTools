using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Agents.Dispatch;

// An agent's open tasks in the order they are started: a vault's current sprint first, then ADO backlog order, then
// age. Its tasks are the ones pinned to it and the ones for any agent of a kind it handles (user decision 2026-10-13);
// tasks without a PBI too (a chat draft's tech-writer task).
public static class OpenAgentTasks
{
    private const string CurrentSprintKey = "currentSprint";

    public static async Task<List<LocalItem>> ListAsync(PowerLoomDbContext db, string agentId, IReadOnlyList<string> handles, CancellationToken cancellation)
    {
        var pinned = AgentStages.AssigneeOf(agentId);
        var kinds = TaskKinds.Parse(handles);
        var sprints = await CurrentSprintsAsync(db, cancellation);

        return await db.LocalItems.AsNoTracking()
            .Where(task => task.Status == ItemStatus.Open && (task.Assignee == pinned || (task.Assignee == AgentStages.AnyAgent && kinds.Contains(task.Kind))))
            .OrderByDescending(task => task.Pbi != null && task.Pbi.IterationPath != null && sprints.Contains(task.Pbi.IterationPath))
            .ThenBy(task => task.Pbi == null || task.Pbi.BacklogPriority == null)
            .ThenBy(task => task.Pbi!.BacklogPriority)
            .ThenBy(task => task.CreatedAt)
            .ToListAsync(cancellation);
    }

    // The sync stores each vault's current sprint as a JSON string under vault:<vault>:currentSprint.
    private static async Task<List<string>> CurrentSprintsAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        var values = await db.Configs.AsNoTracking().Where(row => row.Key.StartsWith("vault:") && row.Key.EndsWith(":" + CurrentSprintKey)).Select(row => row.Value).ToListAsync(cancellation);

        return values.Select(value => JsonSerializer.Deserialize<string>(value)).Where(sprint => !string.IsNullOrEmpty(sprint)).Select(sprint => sprint!).ToList();
    }
}
