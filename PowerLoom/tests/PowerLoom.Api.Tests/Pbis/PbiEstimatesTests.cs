using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Pbis;

// The PBI note shows the PBI's latest estimate from any agent (user decision 2026-10-18); deleting the PBI deletes them.
[Collection(PowerLoomCollection.Name)]
public sealed class PbiEstimatesTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_refinement_region_shows_the_latest_estimate_from_any_agent()
    {
        const int adoId = 69001;
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await SeedAsync(db, adoId);

        var regions = await PipelineRegions.BuildAsync(db, adoId, CancellationToken.None);

        Assert.Contains("Estimate: 12 h human, 3 h agent, complexity 3/5, confidence medium (design): two services change", regions["refinement"]);
        Assert.Contains("Design: [[PBI-69001-design]] (v1).", regions["refinement"]);
        Assert.DoesNotContain("one form", regions["refinement"]);
    }

    [Fact]
    public async Task Deleting_the_pbi_deletes_its_estimates()
    {
        const int adoId = 69002;
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await SeedAsync(db, adoId);

        var deleted = await PbiDeletion.DeleteAsync(db, adoId, CancellationToken.None);

        Assert.True(deleted.Ok);
        Assert.False(await db.PbiEstimates.AnyAsync(row => row.PbiId == adoId));
    }

    // A refinement estimate from before record_estimate (human only), then a newer one from design.
    private static async Task SeedAsync(PowerLoomDbContext db, int adoId)
    {
        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "The login page", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow });
        db.Refinements.Add(new Refinement { PbiId = adoId, Version = 1, Summary = "Scope is clear.", ScopeIn = "[]", ScopeOut = "[]", AcGaps = "[]", Dependencies = "[]", Repos = "[]", Assumptions = "[]", RelevantDocs = "[]", DocsRead = "[]", Skills = "[]" });
        db.Designs.Add(new Design { PbiId = adoId, Version = 1, Approach = "Simple.", Alternatives = "[]", Plan = "[]", Risks = "[]", Tests = "[]", Assumptions = "[]", EstimateBasis = "" });
        db.PbiEstimates.Add(new PbiEstimate { PbiId = adoId, Agent = "refinement", HumanHours = 6m, Basis = "one form", CreatedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc) });
        db.PbiEstimates.Add(new PbiEstimate { PbiId = adoId, Agent = "design", HumanHours = 12m, AgentHours = 3m, Complexity = 3, Confidence = "medium", Basis = "two services change", CreatedAt = new DateTime(2026, 10, 2, 0, 0, 0, DateTimeKind.Utc) });

        await db.SaveChangesAsync();
    }
}
