using System.Net.Http.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Features.Pbis.Attachments.Models;
using PowerLoom.Features.Pbis.Close.Models;
using PowerLoom.Features.Pbis.Create.Models;
using PowerLoom.Features.Pbis.Finish.Models;
using PowerLoom.Features.Pbis.Prepare.Models;
using PowerLoom.Features.Pbis.Repos.Models;
using PowerLoom.Features.Pbis.Skills.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Pbis;

[Collection(PowerLoomCollection.Name)]
public sealed class PbiActionsTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_local_pbi_gets_repos_skills_and_attachments_and_is_finished_with_feedback()
    {
        await SeedAsync();

        var created = await host.Host.PostJson(new CreatePbiRequest(PowerLoomHost.Vault, "Local work", null, null, "Do it", null, null, null), "/api/pbis").Receive<CreatedPbi>();
        var child = await host.Host.PostJson(new CreatePbiRequest(null, "Child of it", "Task", 3, null, null, created!.AdoId, "cli"), "/api/pbis").Receive<CreatedPbi>();
        var adoId = created.AdoId;

        await SeedItemsAsync(adoId);

        var repos = await Tracked(() => host.Host.PutJson(new SaveReposRequest(["ActRepo"]), $"/api/pbis/{adoId}/repos").Receive<SavedRepos>());
        var badSkills = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveSkillsRequest([new SkillChoice("powerloom-x", ""), new SkillChoice("nope", "")])).ToUrl($"/api/pbis/{adoId}/skills");
            scenario.StatusCodeShouldBe(400);
        });
        var skills = await Tracked(() => host.Host.PutJson(new SaveSkillsRequest([new SkillChoice("my-skill", "handy")]), $"/api/pbis/{adoId}/skills").Receive<SavedSkills>());
        var uploaded = await Tracked(() => UploadAsync(adoId));
        var finished = await Tracked(() => host.Host.PostJson(new FinishRequest(8, 2.5m, "Took long", null, null), $"/api/pbis/{adoId}/finish").Receive<FinishedPbi>());
        var pbi = await LoadAsync(adoId);
        var items = await LoadItemsAsync(adoId);

        Assert.True(adoId >= 9000001 && child!.AdoId > adoId);
        Assert.Equal((PowerLoomHost.Vault, adoId), (child.Vault, (await LoadAsync(child.AdoId)).ParentId));
        Assert.Equal(1, repos.Value!.Saved);
        Assert.Equal(ItemStatus.Answered, items[$"Q-{adoId}-001"].Status);
        Assert.Contains("powerloom-x is configured per agent", await badSkills.ReadAsTextAsync());
        Assert.Contains("no skill named nope", await badSkills.ReadAsTextAsync());
        Assert.Equal(1, skills.Value!.Saved);
        Assert.Contains("\"by\": \"user\"", pbi.Skills);
        Assert.NotNull(pbi.SkillsEditedAt);
        Assert.Equal(["ATT-" + uploaded.Value!.Ids[0]], uploaded.Value.Refs);
        Assert.Equal((PipelineStatus.Done, ItemStatus.Cancelled), (pbi.PipelineStatus, items[$"AT-{adoId}-001"].Status));
        Assert.Contains("1 child item(s) done; 1 agent task(s) cancelled", finished.Value!.Message);
        Assert.Equal(PipelineStatus.Done, (await LoadAsync(child.AdoId)).PipelineStatus);
        Assert.NotNull(finished.Value.WwwRecordId);
        Assert.Equal(finished.Value.WwwRecordId.ToString(), finished.Session.Executed.SingleMessage<AddRecord>().SourceId);
        Assert.Contains("PBI-" + adoId + ": Took long", await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md")));
    }

    [Fact]
    public async Task A_closed_pbi_stays_with_its_items_cancelled_skips_prepare_and_reopens_as_new()
    {
        await SeedAsync();

        var created = await host.Host.PostJson(new CreatePbiRequest(PowerLoomHost.Vault, "Went to a colleague", null, null, "Do it", null, null, null), "/api/pbis").Receive<CreatedPbi>();
        var child = await host.Host.PostJson(new CreatePbiRequest(null, "Its child", "Task", 3, null, null, created!.AdoId, "cli"), "/api/pbis").Receive<CreatedPbi>();
        var adoId = created.AdoId;

        await SeedItemsAsync(adoId);

        var closed = await Tracked(() => host.Host.PostJson(new PbiIdsRequest([adoId, 61998], null), "/api/pbis/close").Receive<ClosedPbis>());
        var again = await host.Host.PostJson(new PbiIdsRequest([adoId], null), "/api/pbis/close").Receive<ClosedPbis>();
        var prepared = await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new PrepareRequest([adoId])).ToUrl("/api/pbis/prepare");
            scenario.StatusCodeShouldBe(202);
        });
        var closedPbi = await LoadAsync(adoId);
        var items = await LoadItemsAsync(adoId);
        var reopened = await Tracked(() => host.Host.PostJson(new PbiIdsRequest([adoId], "cli"), "/api/pbis/reopen").Receive<ClosedPbis>());
        var reopenedPbi = await LoadAsync(adoId);

        Assert.Equal([$"PBI-{adoId} closed; 1 child item(s) closed; 2 open item(s) cancelled."], closed.Value!.Done);
        Assert.Equal(["PBI-61998: PBI-61998 isn't in PowerLoom."], closed.Value.Refused);
        Assert.Equal((PipelineStatus.Closed, true), (closedPbi.PipelineStatus, closedPbi.ClosedByUser));
        Assert.Equal(PipelineStatus.Closed, (await LoadAsync(child!.AdoId)).PipelineStatus);
        Assert.Equal((ItemStatus.Cancelled, ItemStatus.Cancelled), (items[$"Q-{adoId}-001"].Status, items[$"AT-{adoId}-001"].Status));
        Assert.Equal([$"PBI-{adoId}: PBI-{adoId} is closed already."], again!.Refused);
        Assert.Equal([adoId], (await prepared.ReadAsJsonAsync<PreparedPbis>())!.Closed);
        Assert.Equal([$"PBI-{adoId} reopened as new."], reopened.Value!.Done);
        Assert.Equal((PipelineStatus.New, false), (reopenedPbi.PipelineStatus, reopenedPbi.ClosedByUser));
        Assert.Equal(PipelineStatus.Closed, (await LoadAsync(child.AdoId)).PipelineStatus);
    }

    private async Task<StoredAttachments?> UploadAsync(int adoId)
    {
        using var client = host.Host.Server.CreateClient();
        using var content = new MultipartFormDataContent { { new StringContent($"Q-{adoId}-001"), "itemId" }, { new ByteArrayContent("hello"u8.ToArray()), "files", "answer.txt" } };
        using var response = await client.PostAsync($"/api/pbis/{adoId}/attachments", content);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<StoredAttachments>();
    }

    private async Task<(T? Value, ITrackedSession Session)> Tracked<T>(Func<Task<T?>> call)
    {
        T? value = default;
        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => value = await call()));

        return (value, session);
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        Directory.CreateDirectory(Path.Combine(host.SkillsRoot, "own", "my-skill"));
        await File.WriteAllTextAsync(Path.Combine(host.SkillsRoot, "own", "my-skill", "SKILL.md"), "---\ndescription: Handy\n---\n");

        if (!File.Exists(Path.Combine(host.VaultRoot, "www-log.md")))
            await File.WriteAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md"), Docs.WwwLogTests.EmptyLog);

        if (!await db.Repos.AnyAsync(repo => repo.Id == "r-act"))
            db.Repos.Add(new Repo { Id = "r-act", AdoProject = "Proj", Name = "ActRepo", RemoteUrl = "https://x", Vault = PowerLoomHost.Vault });

        await db.SaveChangesAsync();
    }

    private async Task SeedItemsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await db.WorkItems.Where(row => row.AdoId == adoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.PipelineStatus, PipelineStatus.Refining));
        db.LocalItems.Add(new LocalItem { Id = $"Q-{adoId}-001", Kind = ItemKind.Question, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Repos?", Status = ItemStatus.Open, Assignee = "human", Data = """{"key":"repos:ActRepo"}""", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = $"AT-{adoId}-001", Kind = ItemKind.Research, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Research", Status = ItemStatus.Open, Assignee = "agent:research", HeldBy = "[]" });

        await db.SaveChangesAsync();
    }

    private async Task<WorkItem> LoadAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == adoId);
    }

    private async Task<Dictionary<string, LocalItem>> LoadItemsAsync(int adoId)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(item => item.PbiId == adoId).ToDictionaryAsync(item => item.Id);
    }
}
