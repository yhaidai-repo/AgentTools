using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class PbiChatTests(PowerLoomHost host)
{
    [Fact]
    public async Task With_a_design_the_note_has_the_plan_and_tests_and_the_link_adds_the_plan_s_repos()
    {
        await StorePbiAsync(31001, "Faster sync", withDesign: true);

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Pbi, "31001"), "/api/chats").Receive<ChatLink>();
        var note = await ReadNoteAsync("pbi-31001");

        Assert.Contains(Uri.EscapeDataString("D:/pc/repos/PVS"), link!.Url);
        Assert.Contains("# Implement PBI-31001: Faster sync", note);
        Assert.Contains("[[PBI-31001-design]] `D:/pc/powerloom-backlog/test-vault/pbi/PBI-31001-faster-sync/PBI-31001-design.md`", note);
        Assert.Contains("## Plan\n\n- [ ] 1. Add the index (PVS; Sync.cs): a covering index", note);
        Assert.Contains("- [ ] 2. Deploy (PVS; –): release **User step: not for the chat.**", note);
        Assert.Contains("## Tests\n\n- [ ] unit: the sync skips nothing", note);
        Assert.Contains("`create-branch` skill for \"#31001 Faster sync\"", note);
        Assert.Contains("- Skills: `sync-skill` (it knows the sync)", note);
        Assert.Contains("bug.report", note);
        Assert.Contains("1. Load the PBI's prepared context, the same the agents get (with the user's own notes): `docker exec -i powerloom-web-1 npm run -s cli -w @powerloom/web -- pbi.read '{\"ref\":\"PBI-31001\"}'`", note);
    }

    [Fact]
    public async Task Without_a_design_the_note_says_so_and_the_chat_still_opens()
    {
        await StorePbiAsync(31002, "Later idea", withDesign: false);

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Pbi, "31002"), "/api/chats").Receive<ChatLink>();
        var note = await ReadNoteAsync("pbi-31002");

        Assert.StartsWith("claude://code/new?", link!.Url);
        Assert.Contains("No design yet: the PBI note and the refinement are the spec", note);
        Assert.Contains("agree the plan with the user", note);
        Assert.DoesNotContain("## Tests", note);
    }

    [Fact]
    public async Task Opening_the_chat_moves_the_pbi_to_development()
    {
        await StorePbiAsync(31003, "Start it", withDesign: false);

        await host.Host.PostJson(new OpenChatRequest(ChatKind.Pbi, "31003"), "/api/chats").Receive<ChatLink>();

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var pbi = await db.WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == 31003);
        var history = await db.StatusHistories.AsNoTracking().SingleAsync(row => row.EntityKind == EntityKind.Pbi && row.EntityId == "31003");

        Assert.Equal(PipelineStatus.Development, pbi.PipelineStatus);
        Assert.Equal(("ready-for-dev", "development", "human"), (history.FromStatus, history.ToStatus, history.Actor));
    }

    [Fact]
    public async Task A_finished_pbi_keeps_its_status_when_its_chat_opens()
    {
        await StorePbiAsync(31004, "Old work", withDesign: false, PipelineStatus.Done);

        await host.Host.PostJson(new OpenChatRequest(ChatKind.Pbi, "31004"), "/api/chats").Receive<ChatLink>();

        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var pbi = await db.WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == 31004);

        Assert.Equal(PipelineStatus.Done, pbi.PipelineStatus);
        Assert.False(await db.StatusHistories.AnyAsync(row => row.EntityKind == EntityKind.Pbi && row.EntityId == "31004"));
    }

    private async Task StorePbiAsync(int adoId, string title, bool withDesign, PipelineStatus status = PipelineStatus.ReadyForDev)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var slug = title.ToLowerInvariant().Replace(' ', '-');

        db.WorkItems.Add(new WorkItem
        {
            AdoId = adoId,
            Type = "Product Backlog Item",
            Title = title,
            AdoState = "Committed",
            ContentHash = "hash",
            Skills = """[{"name":"sync-skill","reason":"it knows the sync"}]""",
            ConfluencePages = "[]",
            Vault = PowerLoomHost.Vault,
            VaultPath = $"pbi/PBI-{adoId}-{slug}/PBI-{adoId}.md",
            PipelineStatus = status,
        });

        if (withDesign)
        {
            db.Designs.Add(new Design
            {
                PbiId = adoId,
                Version = 1,
                Approach = "index it",
                Alternatives = "[]",
                Plan = """[{"step":"Add the index","repo":"PVS","locations":["Sync.cs"],"change":"a covering index","agentDoable":true},{"step":"Deploy","repo":"PVS","locations":[],"change":"release","agentDoable":false}]""",
                Risks = "[]",
                Tests = """[{"kind":"unit","case":"the sync skips nothing"}]""",
                Assumptions = "[]",
            });
        }

        await db.SaveChangesAsync();
    }

    private Task<string> ReadNoteAsync(string name) => File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", $"{name}.md"));
}
