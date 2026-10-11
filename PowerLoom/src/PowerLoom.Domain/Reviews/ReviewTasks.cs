using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Reviews;

// The code-review tasks of a pull request: `local_item` rows of kind review whose data names the PR.
public static class ReviewTasks
{
    public static IQueryable<LocalItem> Of(PowerLoomDbContext db, int prId)
    {
        return db.LocalItems.FromSql($"select * from local_item where kind = 'review' and (data->>'prId')::int = {prId}");
    }

    public static Task<string?> OpenTaskIdAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        return Of(db, prId).Where(item => item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress).Select(item => item.Id).FirstOrDefaultAsync(cancellation);
    }
}
