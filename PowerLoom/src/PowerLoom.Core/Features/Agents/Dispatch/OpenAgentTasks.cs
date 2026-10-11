using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Agents.Dispatch;

// An agent's open tasks in the order they are started: a vault's current sprint first, then ADO backlog order, then
// age. Tasks without a PBI too (a chat draft's tech-writer task).
public static class OpenAgentTasks
{
    private const string CurrentSprintKey = "currentSprint";

    public static async Task<List<LocalItem>> ListAsync(PowerLoomDbContext db, string agentId, CancellationToken cancellation)
    {
        var assignee = AgentStages.AssigneeOf(agentId);
        var sprints = await CurrentSprintsAsync(db, cancellation);

        return await db.LocalItems.AsNoTracking()
            .Where(task => task.Assignee == assignee && task.Status == ItemStatus.Open)
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
