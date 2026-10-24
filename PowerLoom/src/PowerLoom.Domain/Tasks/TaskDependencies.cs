using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Tasks;

// The items a task an agent created must wait for (`data.dependsOn`, chaining v2; user decision 2026-10-13): it starts
// once each is closed in any way. A cancelled or dismissed dependency releases it too, so nothing waits forever.
public static class TaskDependencies
{
    private const string DependsOn = "dependsOn";

    private static readonly ItemStatus[] Unsettled = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked, ItemStatus.Draft];

    public static async Task<List<string>> OpenDependenciesAsync(PowerLoomDbContext db, LocalItem task, CancellationToken cancellation)
    {
        var dependencies = ItemData.StringsOf(task.Data, DependsOn);

        if (dependencies.Count == 0)
            return [];

        return await db.LocalItems.AsNoTracking()
            .Where(item => dependencies.Contains(item.Id) && Unsettled.Contains(item.Status))
            .OrderBy(item => item.Id).Select(item => item.Id).ToListAsync(cancellation);
    }
}
