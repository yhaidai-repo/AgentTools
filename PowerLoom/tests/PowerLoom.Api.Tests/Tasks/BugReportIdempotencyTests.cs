using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Features.Tasks.ReportBug.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class BugReportIdempotencyTests(PowerLoomHost host)
{
    [Fact]
    public async Task Concurrent_and_response_loss_retries_reconcile_to_one_persisted_bug()
    {
        const int parent = 989321;
        using (var scope = host.Host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            ReviewFixSeed.Pbi(db, parent, PowerLoomHost.Vault);
            await db.SaveChangesAsync();
        }
        var request = new ReportBugRequest(parent.ToString(), "Synthetic idempotent bug", "Synthetic details", 2, "agent:autotest", "synthetic-" + Guid.NewGuid().ToString("N"));
        var answers = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => host.Host.PostJson(request, "/api/bugs").Receive<ReportedBug>()));
        var adoId = Assert.IsType<ReportedBug>(answers[0]).AdoId;
        Assert.All(answers, answer => Assert.Equal(adoId, Assert.IsType<ReportedBug>(answer).AdoId));
        // The first caller can lose its response; a later request still receives the durable identity.
        Assert.Equal(adoId, Assert.IsType<ReportedBug>(await host.Host.PostJson(request, "/api/bugs").Receive<ReportedBug>()).AdoId);
        using var verify = host.Host.Services.CreateScope();
        var database = verify.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        Assert.Single(await database.WorkItems.Where(row => row.ParentId == parent).ToListAsync());
        Assert.Single(await database.Bugs.Where(row => row.PbiId == parent).ToListAsync());
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request with { Title = "Different report" }).ToUrl("/api/bugs");
            scenario.StatusCodeShouldBe(System.Net.HttpStatusCode.Conflict);
        });
    }
}
