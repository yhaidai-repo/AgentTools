using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Persistence;

internal static class ReviewFixSeed
{
    public static WorkItem Pbi(PowerLoomDbContext db, int id, string vault)
    {
        var row = new WorkItem { AdoId = id, Vault = vault, Type = "Product Backlog Item", Title = $"PBI {id}", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.Development, SyncedAt = DateTime.UtcNow };
        db.WorkItems.Add(row);
        return row;
    }

    public static LocalItem Item(PowerLoomDbContext db, string id, string vault, string kind = ItemKinds.Docs, int? pbi = null)
    {
        var row = new LocalItem { Id = id, Vault = vault, Kind = kind, PbiId = pbi, Title = id, Status = ItemStatus.Open, Assignee = "agent:*", HeldBy = "[]" };
        db.LocalItems.Add(row);
        return row;
    }

    public static void Capture(PowerLoomDbContext db, int pbi, string name)
    {
        var run = new AgentRun { PbiId = pbi, Stage = "research", Outcome = RunOutcome.Success };
        db.VaultCaptures.Add(new VaultCapture { Run = run, PbiId = pbi, Title = name, Project = "test", Target = "test", Captured = "[]", ToFill = "[]", Name = name, Assumptions = "[]", Status = "created", Errors = "[]" });
    }

    public static PullRequest Pr(PowerLoomDbContext db, int id, string vault)
    {
        var pr = new PullRequest { Id = id, Vault = vault, RepoId = "review-repair", RepoName = "Test", Title = $"PR {id}", SourceRef = "refs/heads/test", TargetRef = "refs/heads/main", SourceCommit = "c1", WorkItemIds = "[]", Url = "https://example.invalid", IsListed = true, Iteration = 1 };
        db.PullRequests.Add(pr);
        db.CodeReviews.Add(new CodeReview { PrId = id, Status = ReviewStatus.Active });
        return pr;
    }
}
