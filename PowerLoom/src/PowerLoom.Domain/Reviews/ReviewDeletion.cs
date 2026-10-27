using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.Domain.Reviews;

// Deleting a review (user decision 2026-10-06): the PR mirror, its review, comments, review tasks and their runs go;
// the pull request check won't list the PR again (deleted_pull_request). ADO is never changed.
public static class ReviewDeletion
{
    public static async Task<string?> ProblemAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        var taskIds = await ReviewTasks.Of(db, prId).Select(item => item.Id).ToListAsync(cancellation);
        var running = await db.AgentRuns.AsNoTracking().Where(run => run.Outcome == RunOutcome.Running && run.ItemId != null && taskIds.Contains(run.ItemId)).Select(run => run.Id).FirstOrDefaultAsync(cancellation);

        return running == 0 ? null : $"RUN-{running} is reviewing PR {prId}; delete it when the run has ended.";
    }

    // The deleted pull request's title.
    public static async Task<Outcome<string>> DeleteAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        var problem = await ProblemAsync(db, prId, cancellation);
        var title = await db.PullRequests.AsNoTracking().Where(row => row.Id == prId).Select(row => row.Title).SingleOrDefaultAsync(cancellation);

        if (problem is not null)
            return Outcome<string>.Failure(Problem.Conflict(problem));

        if (title is null)
            return Outcome<string>.Failure(Problem.NotFound($"PR {prId} isn't in PowerLoom."));

        await DeleteRowsAsync(db, prId, title, cancellation);

        return Outcome<string>.Success(title);
    }

    // Order: comments reference the runs, findings reference their review task, runs reference the tasks.
    private static async Task DeleteRowsAsync(PowerLoomDbContext db, int prId, string title, CancellationToken cancellation)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        var taskIds = await ReviewTasks.Of(db, prId).Select(item => item.Id).ToListAsync(cancellation);
        var findingIds = await db.LocalItems.Where(item => item.ParentId != null && taskIds.Contains(item.ParentId)).Select(item => item.Id).ToListAsync(cancellation);
        var itemIds = taskIds.Concat(findingIds).ToList();

        await db.ReviewComments.Where(comment => comment.PrId == prId).ExecuteDeleteAsync(cancellation);
        await db.CodeReviewVersions.Where(version => version.PrId == prId).ExecuteDeleteAsync(cancellation);

        if (itemIds.Count > 0)
        {
            // Items and runs reference each other (item_id, created_by_run): the items let go of their runs first.
            await db.LocalItems.Where(item => itemIds.Contains(item.Id)).ExecuteUpdateAsync(set => set.SetProperty(item => item.CreatedByRun, (long?)null), cancellation);
            await db.StatusHistories.Where(row => itemIds.Contains(row.EntityId)).ExecuteDeleteAsync(cancellation);
            await db.AgentRuns.Where(run => run.ItemId != null && itemIds.Contains(run.ItemId)).ExecuteDeleteAsync(cancellation);
            await db.LocalItems.Where(item => itemIds.Contains(item.Id)).ExecuteDeleteAsync(cancellation);
        }

        await db.CodeReviews.Where(review => review.PrId == prId).ExecuteDeleteAsync(cancellation);
        await RemovePullRequestAsync(db, prId, cancellation);
        await RememberAsync(db, prId, title, cancellation);
        await transaction.CommitAsync(cancellation);
    }

    // A GitHub PR's row stays, unlisted: its id is PowerLoom's own, so the GitHub check finds the PR by its URL and sees the
    // id among the deleted ones.
    private static async Task RemovePullRequestAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        var rows = db.PullRequests.Where(row => row.Id == prId);

        if (await rows.AnyAsync(row => row.Origin == PullRequestOrigin.Github, cancellation))
            await rows.ExecuteUpdateAsync(set => set.SetProperty(row => row.IsListed, false), cancellation);
        else
            await rows.ExecuteDeleteAsync(cancellation);
    }

    private static async Task RememberAsync(PowerLoomDbContext db, int prId, string title, CancellationToken cancellation)
    {
        var remembered = await db.DeletedPullRequests.SingleOrDefaultAsync(row => row.Id == prId, cancellation);

        if (remembered is null)
            db.DeletedPullRequests.Add(remembered = new DeletedPullRequest { Id = prId });

        remembered.Title = title;
        remembered.DeletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }
}
