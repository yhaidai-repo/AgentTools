using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

public static class HumanTasks
{
    public const string Assignee = "human";

    private const string Prefix = "HT";
    private const int TitleMax = 120;

    public static async Task<string> CreateAsync(PowerLoomDbContext db, NewHumanTask task, CancellationToken cancellation)
    {
        var id = await ItemIds.NextAsync(db, Prefix, task.AdoId, cancellation);
        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == task.AdoId).Select(row => row.Vault).SingleAsync(cancellation);

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Kind = ItemKinds.Human,
            PbiId = task.AdoId,
            Vault = vault,
            Title = task.Title[..Math.Min(task.Title.Length, TitleMax)],
            Status = ItemStatus.Open,
            Assignee = Assignee,
            Body = task.Body,
            Data = task.Data,
            CreatedByRun = task.RunId,
            HeldBy = "[]",
        });

        await db.SaveChangesAsync(cancellation);

        return id;
    }
}
