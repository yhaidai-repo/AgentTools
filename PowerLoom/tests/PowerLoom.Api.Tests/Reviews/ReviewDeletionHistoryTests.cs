using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Domain.Reviews;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Reviews;

[Collection(PowerLoomCollection.Name)]
public sealed class ReviewDeletionHistoryTests(PowerLoomHost host)
{
    [Fact]
    public async Task S2_03_Deletion_includes_versions_and_rolls_everything_back_on_failure()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        const int target = 980130;
        const int other = 980131;
        ReviewFixSeed.Pr(db, target, PowerLoomHost.Vault);
        ReviewFixSeed.Pr(db, other, PowerLoomHost.Vault);
        db.CodeReviewVersions.AddRange(new CodeReviewVersion { PrId = target, ReviewedCommit = "c1" }, new CodeReviewVersion { PrId = other, ReviewedCommit = "c1" });
        await db.SaveChangesAsync();
        await db.CodeReviews.Where(row => row.PrId == target).ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, ReviewStatus.Closed));
        await db.Database.ExecuteSqlRawAsync("""
            CREATE FUNCTION reject_test_review_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.id = 980130 THEN RAISE EXCEPTION 'synthetic deletion failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER reject_test_review_deletion BEFORE INSERT ON deleted_pull_request FOR EACH ROW EXECUTE FUNCTION reject_test_review_deletion();
            """);
        try
        {
            await Assert.ThrowsAnyAsync<Exception>(() => ReviewDeletion.DeleteAsync(db, target, CancellationToken.None));
            Assert.True(await db.PullRequests.AsNoTracking().AnyAsync(row => row.Id == target));
            Assert.True(await db.CodeReviewVersions.AsNoTracking().AnyAsync(row => row.PrId == target));
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("DROP TRIGGER reject_test_review_deletion ON deleted_pull_request; DROP FUNCTION reject_test_review_deletion();");
            db.ChangeTracker.Clear();
        }
        Assert.True((await ReviewDeletion.DeleteAsync(db, target, CancellationToken.None)).Ok);
        Assert.False(await db.CodeReviewVersions.AnyAsync(row => row.PrId == target));
        Assert.True(await db.CodeReviewVersions.AnyAsync(row => row.PrId == other));
    }
}
